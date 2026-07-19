# Design Document — Social Commitment Engine

## 1. Overview

The Social Commitment Engine is an on-chain protocol on Solana devnet that lets fans lock conditional pledges against World Cup match outcomes. If the stated condition is met at full time, funds go to a pre-chosen beneficiary. If not, members reclaim their funds. Settlement is driven by TxLINE's Merkle proof — no admin, no counter-party.

This document translates `req-01.md` into a concrete build plan: account layouts, instruction interfaces, keeper design, indexer schema, frontend component map, and user journeys.

---

## 2. Goals and Non-Goals

### Goals
- Full individual commitment loop: create → resolve → execute/claim
- Group/DAO: create → join/withdraw → resolve → execute/claim
- Keeper: SSE + polling fallback → auto-resolve on `game_finalised`
- Public board backed by off-chain indexer
- In-play pledge card with live score and condition tracking
- Live settlement feed

### Non-Goals
- Counter-party wagering / sportsbook mechanics
- SPL token / USDC — all value in lamports (devnet SOL)
- Mainnet deployment
- Formal DAO governance (join = vote, no quorum)
- Free-form condition composer (fixed templates only)
- Resolver incentive / protocol fee

---

## 3. System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Browser (Next.js)                                                          │
│  ┌──────────────┐  ┌───────────────┐  ┌────────────────┐  ┌─────────────┐ │
│  │ Create Flow  │  │ Public Board  │  │ In-Play Card   │  │ Live Feed / │ │
│  │ (wallet req) │  │ (no wallet)   │  │ (live scores)  │  │ Claims      │ │
│  └──────┬───────┘  └───────┬───────┘  └───────┬────────┘  └──────┬──────┘ │
│         │                  │                  │                   │         │
│         ▼                  ▼                  ▼                   ▼         │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ EscrowInterface → AnchorEscrow (on-chain only)                         ││
│  │  Anchor CPI via @solana/wallet-adapter-react                           ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │
             ┌───────────────────────┼────────────────────┐
             ▼                       ▼                    ▼
   ┌──────────────────┐   ┌──────────────────┐  ┌────────────────────┐
   │  Anchor Program  │   │  Keeper (Node.js) │  │  Indexer           │
   │  (Solana devnet) │   │  ─────────────── │  │  (Postgres +       │
   │                  │   │  SSE + polling    │  │  connection.onLogs)│
   │  Commitment PDA  │   │  → auto-resolve   │  │  → query API       │
   │  Vault PDA       │◄──│  → emit feed evts │  │                    │
   │                  │   │  → score proxy    │  │                    │
   └──────────────────┘   └──────────────────┘  └────────────────────┘
             ▲                       ▲
             └───────────────────────┘
                     TxLINE API
            (fixtures / scores / proofs / SSE)
```

**Data flow summary:**
- All writes go through the Anchor program (or keeper in keeper-custody mode)
- All reads for board/claims go through the indexer query API
- Live score updates (in-play card) come from TxLINE SSE, proxied through the keeper to avoid exposing API credentials in the browser
- The indexer is read-only infrastructure — no settlement or resolution logic depends on it

---

## 4. On-Chain Program (Anchor)

### 4.1 Account: `Commitment`

```rust
#[account]
pub struct Commitment {
    pub fixture_id:         u64,
    pub kickoff_ts:         i64,        // Unix timestamp stored at creation; enforced at join/withdraw
    pub condition_template: u8,         // 0 = BTTS, 1 = TeamWins (see Section 5)
    pub condition_param:    u64,        // 0 for BTTS (ignored); 0=home / 1=away for TeamWins
    pub beneficiary:        Pubkey,
    pub vault:              Pubkey,     // Vault PDA pubkey (cached for convenience)
    pub founder:            Pubkey,
    pub name:               [u8; 64],   // UTF-8 label, null-padded (e.g. "Argentina DAO")
    pub status:             CommitmentStatus,
    pub member_count:       u32,
    pub members:            [MemberEntry; 200],  // pre-allocated; empty slots have wallet = zero (cap set by 10,240-byte CPI allocation limit)
    pub vault_bump:         u8,
    pub bump:               u8,
}

#[derive(Clone, Copy, AnchorSerialize, AnchorDeserialize)]
pub struct MemberEntry {
    pub wallet:           Pubkey,   // Pubkey::default() = empty slot
    pub deposit_lamports: u64,
    pub withdrawn:        bool,
    pub claimed:          bool,
}

#[derive(Clone, Copy, AnchorSerialize, AnchorDeserialize, PartialEq)]
pub enum CommitmentStatus {
    Open,       // accepting joins (before kickoff_ts); resolving (after kickoff_ts)
    Executed,   // condition met; vault released to beneficiary — terminal
    Refunded,   // condition not met; members claim individually — terminal once drained
    Void,       // fixture cancelled or timed out; members claim individually — terminal once drained
    Closed,     // all members withdrew before kickoff; vault empty — terminal
}
```

**Note on intermediate states:** `ResolvedYes` and `ResolvedNo` are not stored on-chain. The `resolve` instruction transitions atomically from `Open` to `Executed` (YES) or `Refunded` (NO) in a single transaction. There is no observable intermediate state.

**Account size estimate:**
- Fixed fields: ~200 bytes (including `name` array)
- 200 × MemberEntry (zero-copy: 32 + 8 + 1 + 1 + 6 pad = 48 bytes): 9,600 bytes
- Total: 9,768 bytes (within the 10,240-byte CPI allocation cap) → approximately 0.069 SOL rent reserve

**PDA seeds:** `["commitment", fixture_id as LE u64, founder_pubkey]`

**Minimum deposit:** 0.01 SOL (10,000,000 lamports). Enforced in `create_commitment` and `join`. Raises the cost of sybil inflation in group DAOs without burdening genuine fans.

### 4.2 Account: `Vault`

A system-owned PDA that holds lamports. No SPL token accounts, no mint interaction.

**PDA seeds:** `["vault", commitment_pubkey]`

Fund movements:
- `create_commitment` / `join`: depositor → vault via `system_program::transfer`
- `resolve` YES: vault → beneficiary atomically in the same resolve transaction
- `claim_refund`: vault → member; if last claimer, vault PDA is closed and rent reserve goes to that claimer

### 4.3 Instructions

#### `create_commitment`

**Accounts:** `[signer=founder, writable=commitment (init), writable=vault (init), system_program]`

**Args:**
```
fixture_id:         u64
kickoff_ts:         i64
condition_template: u8
condition_param:    u64
beneficiary:        Pubkey
deposit_lamports:   u64
name:               [u8; 64]
```

**Logic:**
1. Validate `condition_template` ∈ {0, 1} (BTTS=0, TeamWins=1). Reject unknown values with `ConditionTemplateInvalid`.
2. If `condition_template == 1` (TeamWins), validate `condition_param` ∈ {0, 1}. Reject with `ConditionParamInvalid` otherwise.
3. Validate `kickoff_ts > Clock::get().unix_timestamp`. Reject with `KickoffInPast`.
4. Validate `deposit_lamports >= 10_000_000` (0.01 SOL). Reject with `DepositTooSmall`.
5. Allocate Commitment PDA with space for 200 MemberEntries. Initialize all slots to zero.
6. Record founder as `members[0]` with `deposit_lamports`; set `member_count = 1`.
7. Transfer `deposit_lamports` from founder to vault via system program.
8. Emit `CommitmentCreated { commitment, fixture_id, condition_template, condition_param, beneficiary, deposit_lamports, name }`.

**Errors:** `ConditionTemplateInvalid`, `ConditionParamInvalid`, `KickoffInPast`, `DepositTooSmall`

---

#### `join`

**Accounts:** `[signer=member, writable=commitment, writable=vault, system_program]`

**Args:** `deposit_lamports: u64`

**Logic:**
1. Check `commitment.status == Open`. Reject with `NotOpen`.
2. Check `Clock::get().unix_timestamp < commitment.kickoff_ts`. Reject with `KickoffPassed`.
3. Check `commitment.member_count < 200`. Reject with `MemberLimitReached`.
4. Check signer is not already in `members` with `withdrawn == false`. Reject with `AlreadyMember`. (A wallet that previously withdrew may not rejoin — `withdrawn == true` is also rejected.)
5. Validate `deposit_lamports >= 10_000_000`. Reject with `DepositTooSmall`.
6. Find first empty slot (`wallet == Pubkey::default()`); write member entry; increment `member_count`.
7. Transfer `deposit_lamports` from member to vault.
8. Emit `MemberJoined { commitment, member: signer, deposit_lamports }`.

**Errors:** `NotOpen`, `KickoffPassed`, `MemberLimitReached`, `AlreadyMember`, `DepositTooSmall`

---

#### `withdraw`

**Accounts:** `[signer=member, writable=commitment, writable=vault, system_program]`

**Args:** none

**Logic:**
1. Check `commitment.status == Open`. Reject with `NotOpen`.
2. Check `Clock::get().unix_timestamp < commitment.kickoff_ts`. Reject with `KickoffPassed`.
3. Find signer in `members`; verify `!withdrawn && !claimed`. Reject with `MemberNotFound` or `AlreadyWithdrawn`.
4. Mark `member.withdrawn = true`; decrement `member_count`.
5. Transfer `member.deposit_lamports` from vault to signer.
6. If `member_count == 0`: set `status = Closed`. Emit `CommitmentClosed { commitment }`.
7. Emit `MemberWithdrew { commitment, member: signer, deposit_lamports }`.

**Errors:** `NotOpen`, `KickoffPassed`, `MemberNotFound`, `AlreadyWithdrawn`

---

#### `resolve`

**Accounts:** `[signer=resolver (any), writable=commitment, writable=vault, writable=beneficiary, daily_scores_pda (TxLINE), txline_program, system_program]`

**Args:** `proof: StatValidationInput, strategy: NDimensionalStrategy`

**Logic:**
1. Check `commitment.status == Open`. Reject with `NotOpen` (idempotent guard — if already Executed/Refunded, this fails cleanly with no side effects).
2. CPI `validateStatV2(proof, strategy)` against TxLINE program → returns `bool`.
3. **If `true` (condition met):**
   - Set `commitment.status = Executed`.
   - Transfer full vault balance to `beneficiary` atomically in this transaction.
   - Emit `CommitmentExecuted { commitment, beneficiary, amount_lamports }`.
4. **If `false` (condition not met):**
   - Set `commitment.status = Refunded`.
   - No fund movement. Each member claims individually via `claim_refund`.
   - Emit `CommitmentRefunded { commitment }`.

**Errors:** `NotOpen`, `ProofInvalid` (propagated from TxLINE CPI)

---

#### `claim_refund`

**Accounts:** `[signer=member, writable=commitment, writable=vault, system_program]`

**Args:** none

**Logic:**
1. Check `commitment.status ∈ {Refunded, Void}`. Reject with `NotRefundable`.
2. Find signer in `members`; verify `!withdrawn && !claimed`. Reject with `MemberNotFound` or `AlreadyClaimed`.
3. Mark `member.claimed = true`.
4. Transfer `member.deposit_lamports` from vault to signer.
5. Check if all non-withdrawn members have now claimed. If so: close vault PDA, transfer rent reserve to signer.
6. Emit `RefundClaimed { commitment, member: signer, amount_lamports }`.

**Errors:** `NotRefundable`, `MemberNotFound`, `AlreadyClaimed`

---

#### `void_fixture`

**Accounts:** `[signer=any, writable=commitment, ten_daily_fixtures_pda (TxLINE), txline_program]`

**Args:** `fixture_snapshot, fixture_summary, sub_tree_proof, main_tree_proof`

**Logic:**
1. Check `commitment.status == Open`. Reject with `NotOpen`.
2. CPI `validateFixture(...)` against TxLINE program — verify `gameState == 16` (cancelled). Reject with `FixtureNotCancelled` if not.
3. Set `commitment.status = Void`.
4. Emit `CommitmentVoided { commitment, reason: FixtureCancelled }`.

**Errors:** `NotOpen`, `FixtureNotCancelled`

> **gameState reference (from TxLINE soccer feed docs):** 1=NS · 2=H1 · 3=HT · 4=H2 · 5=Ended · 6=WaitET · 7=ET1 · 8=HTET · 9=ET2 · 10=FET · 11=WaitPens · 12=Shootout · 13=FPE · 14=Interrupted · 15=Abandoned · **16=Cancelled** · 19=Postponed. Only `gameState==16` is the correct cancellation signal. `gameState==6` is WaitET — a knockout match waiting to start extra time — and must never trigger void. A match that is Interrupted (14), Abandoned (15), or Postponed (19) and never transitions to 16 nor emits `game_finalised` is covered by the 7-day `void_timeout` path — no dedicated handling is needed for those states.

---

#### `void_timeout`

**Accounts:** `[signer=member, writable=commitment]`

**Args:** none

**Logic:**
1. Check `commitment.status == Open`. Reject with `NotOpen`.
2. Verify signer is present in `members` with `!withdrawn`. Reject with `MemberNotFound` (only members may trigger timeout — guards against griefing by non-participants).
3. Check `Clock::get().unix_timestamp >= commitment.kickoff_ts + 7 * 86_400`. Reject with `TimeoutNotReached`.
4. Set `commitment.status = Void`.
5. Emit `CommitmentVoided { commitment, reason: Timeout }`.

**Errors:** `NotOpen`, `MemberNotFound`, `TimeoutNotReached`

---

### 4.4 State Machine

```
OPEN
 │
 ├─ resolve (condition met) ──────► EXECUTED    vault → beneficiary atomically; terminal
 │
 ├─ resolve (condition not met) ──► REFUNDED    no fund movement; members claim via claim_refund
 │                                      └─ last claimer → vault PDA closed, rent to claimer
 │
 ├─ void_fixture (gameState=16) ──► VOID        members claim via claim_refund (same path as REFUNDED)
 │
 ├─ void_timeout (7d+ elapsed) ───► VOID        same
 │
 └─ withdraw (last member) ───────► CLOSED      vault empty; terminal
```

No state is reversible. The only instructions valid after `Open` are `claim_refund` (from REFUNDED or VOID) and nothing else.

---

## 5. Condition Templates

Two templates ship for the hackathon. Each is stored as a `u8` (`condition_template`) + `u64` (`condition_param`) in the Commitment account. The keeper and frontend reconstruct the `NDimensionalStrategy` from these two fields at resolve time.

### Template 0: Both Teams Score (BTTS)

| Field | Value |
|---|---|
| `condition_template` | `0` |
| `condition_param` | `0` (ignored) |
| Human label | "Both teams score" |
| Stat keys | `[1, 2]` (P1 goals, P2 goals) |

**Strategy:**
```typescript
const strategyBTTS: NDimensionalStrategy = {
  geometricTargets: [],
  distancePredicate: null,
  discretePredicates: [
    { single: { index: 0, predicate: { threshold: 0, comparison: { greaterThan: {} } } } },
    { single: { index: 1, predicate: { threshold: 0, comparison: { greaterThan: {} } } } },
  ],
};
```

Both stat keys must appear in exactly one predicate — `IncompleteStatCoverage` is thrown by TxLINE otherwise.

### Template 1: Team Wins

| Field | Value |
|---|---|
| `condition_template` | `1` |
| `condition_param` | `0` = home (P1), `1` = away (P2) |
| Human label | "Home team wins" / "Away team wins" |
| Stat keys | `[1, 2]` (P1/P2 total goals; ET goals included via keys 1/2; shootout goals via 6001/6002 excluded) |
| UI disclosure | "Wins on goals — extra time counts; a draw settled by penalty shootout does not satisfy this condition." |

**Strategy (home wins, `condition_param == 0`):**
```typescript
const strategyHomeWin: NDimensionalStrategy = {
  geometricTargets: [],
  distancePredicate: null,
  discretePredicates: [{
    binary: { indexA: 0, indexB: 1, op: { subtract: {} }, predicate: { threshold: 0, comparison: { greaterThan: {} } } }
  }],
};
```

**Strategy (away wins, `condition_param == 1`):** swap `indexA` and `indexB`.

### Template 2: Total Goals ≥ N — Reinstated

*(Previously descoped on the claim that `validateStatV2` cannot express addition. That was wrong — the boilerplate only documented `{ subtract: {} }`, but the on-chain `BinaryExpression` enum is `{ Add, Subtract }`. Verified 2026-07-19 against the real devnet proof for fixture 18241006 (3 total goals): Add/threshold 2/GreaterThan → `true`, Add/threshold 3/GreaterThan → `false`.)*

| Field | Value |
|---|---|
| `condition_template` | `2` |
| `condition_param` | `N` (valid range 1–20, enforced at create) |
| Human label | "N or more goals in the match" |
| Stat keys | `[1, 2]` (P1 + P2 total goals) |

**Strategy (total ≥ N):**
```typescript
const strategyTotalGoals = (n: number): NDimensionalStrategy => ({
  geometricTargets: [],
  distancePredicate: null,
  discretePredicates: [{
    binary: { indexA: 0, indexB: 1, op: { add: {} }, predicate: { threshold: n - 1, comparison: { greaterThan: {} } } }
  }],
});
```

### `buildStrategy` reference

Used by both the keeper (at resolve time) and the frontend (for display):

```typescript
function buildStrategy(template: number, param: number): NDimensionalStrategy {
  switch (template) {
    case 0: return strategyBTTS;
    case 1: return param === 0 ? strategyHomeWin : strategyAwayWin;
    default: throw new Error(`Unknown template: ${template}`);
  }
}

function statKeysForTemplate(template: number): number[] {
  // Both current templates use the same stat keys
  return [1, 2];
}

function conditionLabel(template: number, param: number, homeTeam: string, awayTeam: string): string {
  switch (template) {
    case 0: return 'Both teams score';
    case 1: return param === 0 ? `${homeTeam} wins` : `${awayTeam} wins`;
    default: return 'Unknown condition';
  }
}
```

---

## 6. TxLINE Integration

### 6.1 Auth

- Obtain guest JWT: `POST https://txline-dev.txodds.com/auth/guest/start`
- Subscribe on-chain (service level 1, World Cup free tier): `program.methods.subscribe(1, 4)`
- Activate API token: sign `${txSig}:${leagues}:${jwt}` with keeper wallet; `POST /api/token/activate`
- Store `jwt` + `apiToken` in keeper environment; rotate `jwt` on 401 via axios interceptor
- `X-Api-Token` is stable across JWT rotations — do not re-activate on every 401

### 6.2 Fixture data

The frontend uses the fixture list for the create flow and the board. Fixtures are fetched once at startup and cached:

```
GET /api/fixtures/snapshot?competitionId=72&startEpochDay=20624
```

The indexer stores a `fixtures` table (see Section 8.2) so the board can display team names and kickoff times without re-fetching from TxLINE on every request.

For void detection, the keeper polls:
```
GET /api/fixtures/updates/{epochDay}/{hourOfDay}
```
on the same 30-second poll cycle as score updates. If a tracked fixture appears with `gameState=16` (Cancelled), the keeper fetches the `validateFixture` proof and submits `void_fixture`.

### 6.3 Proof construction for `resolve`

```
1. Keeper receives game_finalised (SSE or poll) — must have action=game_finalised AND statusId=100
2. Read seq from event payload — never default to 0; throw if missing
3. Determine statKeys from commitment.condition_template via statKeysForTemplate()
4. GET /scores/stat-validation?fixtureId=&seq=&statKeys=1,2
5. Build StatValidationInput from response (see txline-boilerplate.md)
6. Derive dailyScoresPda:
     epochDay = Math.floor(val.summary.updateStats.minTimestamp / 86_400_000)  // NOT Date.now()
     PDA seeds: ["daily_scores_roots", epochDay as LE u16]
7. Build NDimensionalStrategy via buildStrategy(commitment.conditionTemplate, commitment.conditionParam)
8. Submit resolve instruction with proof + strategy
```

**Proof fetch retry:** If the stat-validation endpoint returns a non-200 or network error, retry with exponential backoff (1s, 2s, 4s, max 3 attempts). If all retries fail, log the error and wait for the next poll cycle to retry. Do not skip commitments silently.

### 6.4 Proof construction for `void_fixture`

```
1. Keeper detects gameState=16 (Cancelled) on /fixtures/updates poll
2. GET /fixtures/validation?fixtureId=&timestamp={fixture.Ts}
3. Derive tenDailyFixturesRootsPda:
     windowStartDay = Math.floor(epochDay / 10) * 10
     PDA seeds: ["ten_daily_fixtures_roots", windowStartDay as LE u16]
4. Decode packed fixtureId: gameState = Math.floor(packedId / 2^48)
5. Confirm gameState === 16 before submitting
6. Submit void_fixture instruction
```

### 6.5 In-play score proxy

The frontend cannot call TxLINE directly — API credentials must not be exposed in the browser. The keeper exposes a proxied SSE endpoint:

```
GET /api/scores/live?fixtureId=<id>   (keeper internal endpoint)
```

The keeper filters the TxLINE score stream to the requested fixture and forwards events to the browser. The frontend subscribes to this proxy endpoint for in-play card updates.

### 6.6 Stat key reference

| Purpose | statKeys | Proof endpoint |
|---|---|---|
| BTTS (template 0) | `1,2` | `/scores/stat-validation` (V2) |
| TeamWins (template 1) | `1,2` | `/scores/stat-validation` (V2) |
| TotalGoals ≥ N | — | descoped; see Section 5 |
| In-play display (goals + cards) | `1,2,5,6` | display only via score proxy; no CPI |
| Void verification | — | `/fixtures/validation` |

> **Stat key period-prefix formula (authoritative):** key = period_prefix + base. Bases: 1/2=goals, 3/4=yellows, 5/6=reds, 7/8=corners. Prefixes: 0=total, 1000=H1, 2000=HT, 3000=H2, 4000=ET1, 5000=ET2, 6000=shootout, 7000=ET-total. Examples: `1001/1002`=H1 goals, `3001/3002`=H2 goals (not ET — the boilerplate `txline-boilerplate.md` labels `3001` as "ET goals" which is wrong), `4001/4002`=ET1 goals, `6001/6002`=shootout goals. Keys `[1,2]` are cumulative total goals at `game_finalised` — correct for both BTTS and TeamWins templates.

---

## 7. Keeper Design

The keeper is a Node.js process. It is the only service that holds TxLINE API credentials and the resolver wallet keypair.

### 7.1 Environment variables

| Variable | Required | Description |
|---|---|---|
| `ANCHOR_WALLET` | Yes | Path to resolver keypair JSON |
| `ANCHOR_PROVIDER_URL` | Yes | Solana devnet RPC URL |
| `TXLINE_JWT` | Yes | Initial JWT (renewed automatically on 401) |
| `TXLINE_API_TOKEN` | Yes | Stable API token (from activation) |
| `ESCROW_MODE` | Yes | `on-chain` or `keeper-custody` |
| `PROGRAM_ID` | Yes | Deployed Commitment program address |
| `INDEXER_URL` | Yes | Base URL of indexer query API |
| `PORT` | No | Keeper HTTP port (default 3001) |
| `REPLAY_FIXTURE_ID` | No | If set, skips SSE and replays a historical fixture |
| `POLL_INTERVAL_MS` | No | Score poll interval in ms (default 30000) |

### 7.2 Boot sequence

```
1. Load and validate all required env vars — fail fast if any missing
2. If REPLAY_FIXTURE_ID set → enter replay mode (go to step 6)
3. Start SSE subscription: subscribeScores()     ← BUG-04 fix: call at boot
4. Start score poll loop at POLL_INTERVAL_MS
5. Start fixture updates poll loop (gameState=6 detection) at POLL_INTERVAL_MS
6. Load active commitments: query indexer GET /api/board?status=Open
   (fall back to on-chain program account scan if indexer is unavailable)
7. Start HTTP server (keeper API)
8. Enter event loop
```

### 7.3 SSE channel

```typescript
function subscribeScores() {
  const es = new EventSource(`${API_BASE_URL}/scores/stream`, { fetch: authFetch });
  es.onmessage = (event) => {
    if (event.lastEventId) lastSeenId = event.lastEventId;
    const data = JSON.parse(event.data);
    // BUG-01 fix: only fire on fully finalised signal
    if (data.action === 'game_finalised' && data.statusId === 100) {
      handleFinalised(data.FixtureId, data.seq);
    }
  };
  es.onerror = () => {
    logger.warn('SSE disconnected — polling continues independently');
    es.close();
    setTimeout(subscribeScores, 3_000);
  };
}
```

### 7.4 Polling channel (independent fallback)

```typescript
async function pollScores() {
  const now = Date.now();
  for (let i = 0; i < 24; i++) {  // scan last 2 hours
    const t = new Date(now - i * 300_000);
    const epochDay = Math.floor(t.getTime() / 86_400_000);
    const hour = t.getUTCHours();
    const interval = Math.floor(t.getUTCMinutes() / 5);
    const records = await apiClient.get(`/scores/updates/${epochDay}/${hour}/${interval}`);
    for (const r of records.data) {
      if (r.action === 'game_finalised' && !resolvedFixtures.has(r.FixtureId)) {
        handleFinalised(r.FixtureId, r.seq);
      }
    }
  }
}
setInterval(pollScores, POLL_INTERVAL_MS);
```

### 7.5 `handleFinalised`

```typescript
async function handleFinalised(fixtureId: number, seq: number) {
  if (!seq) { logger.error(`game_finalised for ${fixtureId} missing seq — skipping`); return; }  // BUG-02 fix
  resolvedFixtures.add(fixtureId);  // mark to avoid duplicate processing from SSE + poll

  const commitments = await indexerClient.get(`/api/board?fixture_id=${fixtureId}&status=Open`);
  for (const c of commitments.data) {
    try {
      const statKeys = statKeysForTemplate(c.conditionTemplate);
      const proof = await fetchStatValidationProofWithRetry(fixtureId, seq, statKeys);
      const strategy = buildStrategy(c.conditionTemplate, c.conditionParam);
      const txSig = await sendResolveTransaction(c.pubkey, proof, strategy);

      // BUG-03 fix: emit only after tx confirms
      const conditionMet = await getResolutionOutcome(c.pubkey);
      emitFeedEvent({ type: 'resolved', commitment: c, conditionMet, txSig });
    } catch (e) {
      if (isAlreadyResolved(e)) { continue; }  // idempotent
      logger.error(`resolve failed for ${c.pubkey}`, e);
    }
  }
}
```

**NO path feed event:** `emitFeedEvent` is called regardless of `conditionMet` — the feed shows both YES (settlement) and NO (refund available) outcomes.

### 7.6 Auto-void on fixture cancellation

```typescript
async function pollFixtures() {
  const now = Date.now();
  const epochDay = Math.floor(now / 86_400_000);
  const hour = new Date(now).getUTCHours();
  const updates = await apiClient.get(`/fixtures/updates/${epochDay}/${hour}`);
  for (const f of updates.data) {
    const gameState = Math.floor(f.FixtureId / 281474976710656);
    const pureFixtureId = f.FixtureId % 281474976710656;
    if (gameState === 16) {   // 16 = Cancelled; 6 = WaitET and must never trigger void
      await handleFixtureCancelled(pureFixtureId, f.Ts);
    }
  }
}

async function handleFixtureCancelled(fixtureId: number, timestamp: number) {
  const commitments = await indexerClient.get(`/api/board?fixture_id=${fixtureId}&status=Open`);
  if (commitments.data.length === 0) return;
  const proof = await fetchFixtureValidationProof(fixtureId, timestamp);
  for (const c of commitments.data) {
    await sendVoidFixtureTransaction(c.pubkey, proof);
  }
}
```

### 7.7 Replay mode

When `REPLAY_FIXTURE_ID` is set:
- Skip SSE subscription and poll loops
- Poll `GET /scores/historical/${REPLAY_FIXTURE_ID}` at boot to get a finalised score record
- Feed `FixtureId` and `seq` directly into `handleFinalised`
- Frontend receives the same events via the keeper's internal event bus — no frontend changes needed to switch modes

### 7.8 Keeper API (HTTP server)

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/feed` | none | SSE stream of resolution events for the live feed |
| `GET` | `/api/scores/live?fixtureId=` | none | SSE proxy of TxLINE score stream for in-play card |
| `GET` | `/api/commitments/:fixtureId` | none | Active Open commitments for a fixture |
| `POST` | `/api/resolve/:commitmentPubkey` | internal | Manual resolve trigger (fallback for keeper failure) |
| `GET` | `/api/health` | none | Liveness check |

---

## 8. Off-Chain Indexer

### 8.1 Purpose

Solana accounts cannot be queried like a relational database. The indexer listens to on-chain program events and maintains Postgres tables that power the public board, in-play card, and pending-claims view. It is read-only infrastructure — no settlement or resolution logic depends on it. On-chain state is always the source of truth.

### 8.2 Schema

```sql
-- Fixture metadata from TxLINE /fixtures/snapshot
CREATE TABLE fixtures (
  fixture_id    BIGINT PRIMARY KEY,
  home_team     TEXT NOT NULL,
  away_team     TEXT NOT NULL,
  competition   TEXT NOT NULL,
  kickoff_ts    BIGINT NOT NULL,    -- Unix ms
  game_state    SMALLINT NOT NULL DEFAULT 0
);

CREATE TABLE commitments (
  pubkey             TEXT PRIMARY KEY,
  fixture_id         BIGINT NOT NULL REFERENCES fixtures(fixture_id),
  kickoff_ts         BIGINT NOT NULL,
  condition_template SMALLINT NOT NULL,
  condition_param    BIGINT NOT NULL,
  condition_label    TEXT NOT NULL,    -- "Both teams score", "Home team wins", "Away team wins"
  beneficiary        TEXT NOT NULL,
  founder            TEXT NOT NULL,
  name               TEXT NOT NULL,
  status             TEXT NOT NULL,   -- Open | Executed | Refunded | Void | Closed
  member_count       INT NOT NULL DEFAULT 0,
  total_lamports     BIGINT NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL,
  resolved_at        TIMESTAMPTZ,
  settlement_tx      TEXT             -- Solana tx signature; null until Executed
);

CREATE TABLE commitment_members (
  commitment_pubkey TEXT NOT NULL REFERENCES commitments(pubkey),
  wallet            TEXT NOT NULL,
  deposit_lamports  BIGINT NOT NULL,
  withdrawn         BOOLEAN NOT NULL DEFAULT false,
  claimed           BOOLEAN NOT NULL DEFAULT false,
  joined_at         TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (commitment_pubkey, wallet)
);

CREATE INDEX idx_commitments_fixture    ON commitments(fixture_id);
CREATE INDEX idx_commitments_status     ON commitments(status);
CREATE INDEX idx_commitments_lamports   ON commitments(total_lamports DESC);
CREATE INDEX idx_commitments_members    ON commitments(member_count DESC);
CREATE INDEX idx_members_wallet         ON commitment_members(wallet);
CREATE INDEX idx_members_unclaimed      ON commitment_members(wallet, claimed) WHERE claimed = false;
```

### 8.3 Event listener

The indexer uses `connection.onLogs` to listen to program events on devnet. Each log line is parsed for Anchor event discriminators.

| Program event | Indexer action |
|---|---|
| `CommitmentCreated` | INSERT into commitments; INSERT member (founder) into commitment_members |
| `MemberJoined` | INSERT into commitment_members; UPDATE commitments.member_count + total_lamports |
| `MemberWithdrew` | UPDATE commitment_members.withdrawn = true; UPDATE commitments.member_count, total_lamports |
| `CommitmentExecuted` | UPDATE commitments: status=Executed, resolved_at, settlement_tx, total_lamports=0 |
| `CommitmentRefunded` | UPDATE commitments: status=Refunded, resolved_at |
| `RefundClaimed` | UPDATE commitment_members.claimed = true; check if all claimed → could update total_lamports |
| `CommitmentVoided` | UPDATE commitments: status=Void, resolved_at |
| `CommitmentClosed` | UPDATE commitments: status=Closed |

**Missed-event recovery:** On startup and every 10 minutes, the indexer reconciles its DB against on-chain state by scanning the program's accounts using `getProgramAccounts`. Discrepancies (status mismatch, member count mismatch) are corrected. This handles the case where a log event was missed due to a dropped websocket connection.

### 8.4 Query API

```
GET /api/board
  ?status=Open|Executed|Refunded|Void         (filter by status; default: all)
  ?fixture_id=<id>                             (filter by fixture)
  ?sort=total_lamports|member_count|created_at (default: total_lamports DESC)
  ?limit=20&offset=0                           (pagination)

GET /api/commitment/:pubkey
  → full commitment detail including member list

GET /api/claims?wallet=<pubkey>
  → all commitment_members rows where wallet=<pubkey> AND withdrawn=false AND claimed=false
    joined with commitments where status IN (Refunded, Void)

GET /api/fixtures?status=upcoming|live|finished
  → fixture list for create flow and board filtering

GET /api/feed
  → SSE stream (proxied from keeper /api/feed)
```

---

## 9. Frontend (Next.js)

### 9.1 Pages

| Route | Wallet required | Purpose |
|---|---|---|
| `/` | No | Public board — all commitments across all fixtures |
| `/fixture/:id` | No (wallet for create) | Fixture detail + create commitment form |
| `/commitment/:pubkey` | No (wallet for actions) | Commitment detail + in-play card + actions |
| `/claims` | Yes | All pending refunds for the connected wallet |

### 9.2 Component tree

```
Layout
  ├─ Header
  │   ├─ WalletButton           connect / disconnect / show address
  │   └─ ClaimsBadge            pending refund count; links to /claims; visible when wallet connected

/ (Public Board)
  ├─ FixtureFilter              filter by fixture or status
  ├─ BoardSort                  sort by pledged amount / member count
  ├─ CommitmentCard[]           grid of commitments (see 9.3)
  └─ LiveFeed                   SSE feed of recent resolutions (right panel or bottom strip)

/fixture/:id
  ├─ FixtureHeader              home team vs away team, kickoff time, score if live
  ├─ CommitmentCard[]           existing commitments for this fixture
  └─ CreateCommitmentForm       3-step wizard (see 9.4)

/commitment/:pubkey
  ├─ CommitmentHeader           name, fixture, status badge
  ├─ InPlayCard                 live score + condition status (visible during Open match)
  │   ├─ LiveScore              SSE-updated from keeper /api/scores/live
  │   ├─ ConditionStatus        tracking / met / resolved with plain-language description
  │   └─ EventLog               goals and cards with timestamp and team
  ├─ CommitmentMeta             beneficiary, total pledged, member count
  ├─ MemberList                 member addresses and deposits (founder first)
  ├─ JoinButton                 visible if commitment is Open AND clock < kickoff_ts AND wallet connected
  ├─ WithdrawButton             visible if wallet is a member AND clock < kickoff_ts
  ├─ ResolveButton              visible if commitment is Open AND any wallet connected
  │                             (normally the keeper does this; this is the manual fallback)
  ├─ VoidButton                 visible if Open AND (fixture cancelled OR 7d timeout reached)
  └─ ClaimRefundButton          visible if status is Refunded/Void AND wallet is unclaimed member

/claims
  ├─ ClaimsHeader               total claimable SOL across all commitments
  └─ ClaimItem[]                one per open claim: fixture, condition, amount, Claim button
```

### 9.3 `CommitmentCard` data

Displayed in all list views:

```
[Commitment name]         e.g. "Argentina DAO"
[Fixture]                 e.g. "Argentina vs France · Group Stage"
[Condition]               human-readable, e.g. "Home team wins"
[Status badge]            Open · Executed · Refunded · Void · Closed
[Total pledged]           e.g. "12.1 SOL"
[Members]                 e.g. "38 members" (omitted for individual commitments)
[Beneficiary]             truncated address or label
[Settlement tx link]      visible only when Executed, links to Solana explorer
```

### 9.4 Create Commitment Flow (3 steps)

**Step 1 — Select condition**

Two cards:
- "Both teams score" — no param required
- "Home team wins" / "Away team wins" — radio to choose which team
  - Disclosure text shown inline: *"Wins on goals. Extra time counts. A draw settled by penalty shootout does not satisfy this condition."*

**Step 2 — Beneficiary and amount**

- Beneficiary address field (paste only — no autocomplete)
- Warning below field: *"This address is unverified and cannot be changed after you sign. Funds sent here are permanent."*
- SOL amount input (minimum 0.01 SOL enforced in UI before submission)
- Optional commitment name field (max 64 bytes, defaults to "{Team} DAO" or "{Condition} pledge")

**Step 3 — Review and sign**

Summary card showing:
- Fixture
- Condition (human-readable)
- Beneficiary (full address)
- Amount (in SOL)
- Name

Single "Sign and lock" button → calls `EscrowInterface.createCommitment()` → wallet approval modal → tx confirmation → redirect to `/commitment/:pubkey`.

### 9.5 Escrow interface abstraction

```typescript
interface CreateParams {
  fixtureId:         number;
  kickoffTs:         number;
  conditionTemplate: number;
  conditionParam:    number;
  beneficiary:       string;
  depositLamports:   number;
  name:              string;
}

interface EscrowInterface {
  createCommitment(params: CreateParams): Promise<string>;   // → tx sig
  joinCommitment(pubkey: string, lamports: number): Promise<string>;
  withdraw(pubkey: string): Promise<string>;
  resolve(pubkey: string): Promise<string>;
  claimRefund(pubkey: string): Promise<string>;
  voidFixture(pubkey: string, proof: FixtureProof): Promise<string>;
  voidTimeout(pubkey: string): Promise<string>;
}

// On-chain only — AnchorEscrow is the sole implementation.
// The interface is retained so the abstraction boundary is explicit and testable.
const escrow: EscrowInterface = new AnchorEscrow(program, wallet);
```

### 9.6 Wallet adapter

- Provider: `@solana/wallet-adapter-react`
- Supported wallets: Phantom, Solflare, Backpack
- `WalletMultiButton` in header — handles connect, display, and disconnect
- All write calls gate on `wallet.connected` — if not connected, clicking an action button opens the connect modal instead
- Board and commitment detail pages load without any wallet connection

### 9.7 In-play data source

- LiveScore and EventLog subscribe to `GET /api/scores/live?fixtureId=<id>` (keeper proxy) via EventSource
- ConditionStatus is derived client-side from live score data + `commitment.conditionTemplate` + `commitment.conditionParam`
- Three display states:
  - **Tracking** — condition still possible, not yet met: "Both teams yet to score · 0–0 (34')"
  - **Met** — condition satisfied with play ongoing: "Both teams have scored ✓ · 1–1 (67')"
  - **Resolved** — match finalised, outcome confirmed on-chain
- Status only advances to **Resolved** after a `resolved` event arrives on `/api/feed` — never derived from score data alone (FR-15.5)

### 9.8 Error and loading states

| Scenario | UI behaviour |
|---|---|
| Transaction rejected by wallet | Toast: "Transaction cancelled." No state change. |
| Transaction fails on-chain | Toast: "Transaction failed — [reason from program error]." Log the error. |
| `KickoffPassed` from join | Join button hidden client-side; server-side guard is the canonical check. |
| `MemberLimitReached` | Toast: "This DAO has reached its 200-member limit." |
| `DepositTooSmall` | Input validation before submission: "Minimum deposit is 0.01 SOL." |
| `AlreadyClaimed` | Claim button hidden for already-claimed members. |
| Indexer unavailable | Board shows stale data with a banner: "Data may be delayed." On-chain state unaffected. |
| Keeper SSE disconnected | `/api/feed` reconnects automatically; in-play card shows "Reconnecting…" |

---

## 10. Key Flows

### 10.1 Individual commitment — YES path

```
Fan connects wallet → selects fixture → opens CreateCommitmentForm
Step 1: picks "Home team wins" (condition_template=1, condition_param=0)
Step 2: pastes beneficiary address, enters 0.5 SOL, names pledge "My Argentina Pledge"
Step 3: signs → create_commitment tx lands on-chain
  → vault funded with 0.5 SOL
  → Indexer: CommitmentCreated → board shows new card

[Match starts — JoinButton and WithdrawButton disappear (kickoff_ts passed)]
[InPlayCard shows: "Tracking · 0–0 (12')"]
[Goal scored → "Tracking · 1–0 (34') — Argentina leads"]
[Full time 2–1]

Keeper: game_finalised via SSE (statusId=100)
  → fetchStatValidationProof(fixtureId, seq, [1,2])
  → buildStrategy(1, 0) → homeWin strategy
  → sendResolveTransaction(commitment, proof, strategy)
  → TX confirms → status = Executed; vault → beneficiary 0.5 SOL

emitFeedEvent({ conditionMet: true, txSig })     ← after tx confirms (BUG-03 fix)
LiveFeed: "0.5 SOL → [beneficiary] · Argentina vs France · Home team wins ✓"
InPlayCard: status → "Resolved · Condition met"
CommitmentCard: badge → "Executed" + explorer link
```

### 10.2 Individual commitment — NO path

```
[Same create flow, same match, different outcome: match ends 0–1]

Keeper: game_finalised → buildStrategy(1, 0) → homeWin
  → validateStatV2: P1 goals (0) − P2 goals (1) = −1, not > 0 → false
  → resolve tx → status = Refunded (no fund movement)

emitFeedEvent({ conditionMet: false })
LiveFeed: "Pledge not met · Argentina vs France · Home team wins ✗ · 0.5 SOL refundable"
InPlayCard: status → "Resolved · Condition not met — your pledge is refundable"
ClaimRefundButton appears (fan is the only member)
  → fan clicks → claimRefund tx → 0.5 SOL returned
  → vault account closed, rent to fan
ClaimsBadge in header: disappears
```

### 10.3 Group DAO — YES path

```
Founder creates "Brazil DAO" (condition_template=0 BTTS, beneficiary=charity, 1 SOL)
  → commitment Open; appears on board as "1 member · 1 SOL"

12 fans browse board → click Join → each deposits 0.5–2 SOL
  → board updates: "13 members · 14.5 SOL"

Kickoff passes:
  → JoinButton, WithdrawButton both disabled (KickoffPassed returned if called)

Match ends 2–1 (both teams scored)
Keeper: game_finalised → BTTS strategy → validateStatV2 → true
  → resolve tx → status = Executed; 14.5 SOL → charity wallet atomically

LiveFeed: "14.5 SOL → [charity] · Brazil vs Germany · Both teams score ✓ · 13 members"
```

### 10.4 Withdraw before kickoff

```
Member joins "Argentina DAO" at 2 SOL (kickoff in 3h)
  → has second thoughts 1 hour before kickoff

Goes to commitment detail page → WithdrawButton visible (clock < kickoff_ts)
  → clicks Withdraw → withdraw tx
  → 2 SOL returned to wallet immediately
  → member_count decrements; total_lamports decrements on board

If they were the last member:
  → status = Closed; vault empty; commitment disappears from board active view
```

### 10.5 Void — fixture cancellation

```
Fixture is cancelled (TxLINE sets gameState=16 in fixtures/updates)

Keeper fixture poll detects gameState=16
  → fetchFixtureValidationProof(fixtureId, timestamp)
  → sendVoidFixtureTransaction(commitment, proof) for each Open commitment on that fixture
  → status = Void

All members see ClaimRefundButton appear
Each member calls claimRefund individually — no deadline
Last member's claim closes the vault
```

### 10.6 Void — timeout

```
Match date was 7+ days ago; TxLINE never emitted game_finalised (outage / disputed match)
Commitment is still Open; funds frozen

Any member navigates to commitment detail
  → VoidButton visible (commitment is Open AND clock >= kickoff_ts + 7*86400)
  → clicks "Force Void" → void_timeout tx
  → status = Void; ClaimRefundButton appears for all members
```

### 10.7 Manual resolve (keeper fallback)

```
Keeper is down when game_finalised fires; SSE and poll both missed it

Fan notices their commitment is still Open after the match
  → navigates to commitment detail
  → ResolveButton is visible (any wallet can resolve once match is done)
  → clicks "Resolve" → frontend calls EscrowInterface.resolve(pubkey)

In on-chain mode:
  → Frontend calls keeper GET /api/resolve/:pubkey (triggers keeper to fetch proof + submit)
  OR
  → Frontend fetches proof directly (if proof endpoint is exposed server-side) and submits tx

Resolution completes on-chain; same feed event + status update as keeper-driven flow
```

---

## 11. User Journeys

### 11.1 Actors

| Actor | Wallet required | Primary goal |
|---|---|---|
| Individual Pledger | Yes | Lock a personal condition pledge before a match |
| DAO Founder | Yes | Create a collective commitment around a team |
| DAO Member | Yes | Co-sign a group commitment; recover funds if condition not met |
| Observer | No | Browse commitments; watch live settlements |
| Beneficiary | No | Receive funds automatically if condition is met |
| Manual Resolver | Yes | Trigger resolution as a fallback if keeper is down |

### 11.2 Observer journey (no wallet)

The public board is the default view. An observer arrives and sees a grid of commitment cards sorted by total pledged. No connect prompt, no gate.

They can:
- Filter by fixture or status
- Click any card to read the commitment detail and member list
- Watch the live feed as resolutions land in real time
- See explorer links on resolved commitments

They cannot create, join, withdraw, resolve, or claim without connecting a wallet.

### 11.3 Individual pledger journey

1. Connects wallet (Phantom / Solflare / Backpack)
2. Browses the fixture list or public board to find an upcoming match
3. Navigates to fixture → opens create form
4. Picks a condition (BTTS or team wins)
5. Pastes a beneficiary address; reads the unverified-address warning
6. Enters an amount ≥ 0.01 SOL; optionally names the pledge
7. Reviews the summary and signs
8. Sees their commitment appear on the board
9. During the match: watches the in-play card update with live score and condition status
10. After full time: keeper auto-resolves
    - **YES** — feed shows settlement; explorer link appears; done
    - **NO** — header badge shows "1 pending claim"; visits /claims; clicks Claim; funds returned

At no point does the pledger need to do anything to enable resolution — the keeper handles it. The only required action after creation is claiming a refund on the NO path.

### 11.4 DAO founder journey

1. Connects wallet
2. Navigates to a fixture → opens create form (same as individual)
3. Creates commitment — this is now Open and visible on board
4. Shares the commitment URL or the public board with their community (off-chain)
5. Watches member count and total pledged grow as fans join
6. Before kickoff: can withdraw their own deposit if they change their mind (same as any member)
7. After kickoff: same resolution experience as individual pledger

The founder has no special in-app authority after creation. They cannot close the DAO, change the condition, or approve/reject members.

### 11.5 DAO member journey

1. Browses public board → finds an open group commitment
2. Reads the commitment detail: condition, beneficiary, current members, total pledged
3. Connects wallet → clicks Join → enters deposit amount → signs
4. Their address appears in the member list; total pledged updates
5. Before kickoff: can withdraw full deposit if they change their mind (WithdrawButton visible)
6. After kickoff: join and withdraw are no longer possible
7. After resolution:
    - **YES** — sees settlement in feed; no action required (they committed, they're happy)
    - **NO** — header badge shows pending claim; visits /claims → claims refund → funds returned

### 11.6 Beneficiary experience

The beneficiary is a passive recipient. They do not need to consent, create an account, or take any action. If the condition is met, SOL arrives in their wallet in the same transaction that resolves the commitment. The `CommitmentExecuted` event (if the beneficiary is watching on-chain) and the live feed entry serve as notification.

### 11.7 Manual resolver journey

A fan notices a commitment is still Open long after the match ended — the keeper was down.

1. Navigates to commitment detail
2. Sees ResolveButton (visible to any connected wallet on an Open commitment after match time)
3. Clicks Resolve → frontend calls keeper `/api/resolve/:pubkey` which fetches proof and submits tx
4. If keeper is entirely unavailable, an advanced user can construct and submit the tx manually using the TxLINE proof endpoints documented in `txline-boilerplate.md`

Resolution is permissionless — no designated role is required.

---

## 12. Build Order

### Phase 1 — Individual commitment core

Target: full proof pipeline green; first demo-able flow.

1. **Anchor program:** `create_commitment`, `resolve` (YES + NO paths), `claim_refund`
   - Condition templates 0 (BTTS) and 1 (TeamWins) only
   - `members[0]` is founder; no join/withdraw yet
2. **Keeper:** boot with SSE + polling fallback; `handleFinalised` → resolve tx
   - Apply BUG-01, BUG-02, BUG-03, BUG-04 fixes before first test
   - Replay mode via `REPLAY_FIXTURE_ID`
3. **Frontend:** create flow, commitment detail, in-play card, resolve button, explorer link
4. **Indexer:** event listener + basic board query (can stub with `getProgramAccounts` scan initially)

Kill clock: if keeper not firing cleanly by hour 8, trigger `game_finalised` manually in replay mode and test the resolve tx in isolation.

### Phase 2 — Group DAO

Start only once Phase 1 is end-to-end green.

5. **Anchor:** `join`, `withdraw`, member cap check, pro-rata `claim_refund` (last claimer closes vault)
6. **Frontend:** JoinButton, WithdrawButton, member list, /claims page, ClaimsBadge header
7. **Indexer:** member join/withdraw events; claims query endpoint

### Phase 3 — Polish (if time permits)

8. `void_fixture` instruction + keeper auto-void detection on gameState=16
9. `void_timeout` instruction + VoidButton in UI
10. Live settlement feed (SSE-backed, real-time)
11. ClaimsBadge pending-claim notifications
12. Full indexer reconciliation pass

---

## 13. Bug Fixes Required Before First Demo

All four bugs in `build-bugs.md` must be fixed before any keeper test:

| Bug | File | Fix |
|---|---|---|
| BUG-01: `GameState=3` triggers resolution | `server/txline.mjs` | Only fire on `action=game_finalised` && `statusId=100` |
| BUG-02: `seq ?? 0` | `server/keeper.mjs` | Read seq from event payload; throw if falsy |
| BUG-03: `condition_met` emitted before evaluation | Keeper feed emitter | Emit only after resolve tx confirms on-chain |
| BUG-04: `subscribeScores` never called at boot | Keeper boot sequence | Call at startup; `REPLAY_FIXTURE_ID` is a dev-only override |

---

## 14. Non-Functional Checklist

| NFR | Design coverage |
|---|---|
| NFR-1 Trustless | No admin key in resolve path; `validateStatV2` CPI is the only resolution oracle |
| NFR-2 Permissionless resolution | `resolve`, `void_fixture`, `void_timeout` accept any signer |
| NFR-3 Transparency | All state on-chain; indexer is read-only and non-authoritative |
| NFR-4 No counter-party | Beneficiary defined at creation; no opposing bet structure possible |
| NFR-5 Devnet scope | All configs: devnet RPC, `txline-dev.txodds.com` API host, devnet program ID |
| NFR-6 ESCROW_MODE abstraction | Frontend uses `EscrowInterface`; mode is a build-time env var; no frontend changes needed to switch |

---

## 15. Open Questions

| # | Question | Resolution |
|---|---|---|
| Q1 | Does "Total Goals ≥ N" fit in a single `validateStatV2` call? | **Resolved — descoped.** validateStatV2 supports single-stat and binary-subtract predicates only; addition is not expressible. Three workarounds evaluated and rejected. See Section 5. |
| Q2 | Indexer: `connection.onLogs` or Helius webhooks? | **Resolved.** `connection.onLogs` for hackathon (no additional service dependency). Add missed-event reconciliation via `getProgramAccounts` scan every 10 minutes as a safety net. Helius for production. |
| Q3 | Beneficiary registry — curated or open addresses? | **Resolved.** Open addresses for hackathon. UI shows unverified-address warning at creation (Step 2 of create flow). Curated registry is a post-hackathon feature. |
| Q4 | Minimum deposit for group join? | **Resolved.** 0.01 SOL minimum enforced in both `create_commitment` and `join` instructions. Raises cost of sybil inflation without materially deterring genuine fans. |
| Q5 | Which `ESCROW_MODE` for the hackathon? | **Resolved — on-chain only.** Anchor program holds funds in a vault PDA; the keeper submits transactions but never holds funds. `keeper-custody` mode is not implemented. `KeeperEscrow` class in the frontend interface is a stub; only `AnchorEscrow` is wired up. |
| Q6 | Replay fixture ID for demo? | **Resolved — replay-only.** Use `18241006` England vs Argentina (Jul 15) for deterministic replay — confirmed replayable via `/scores/historical/`. Both teams scored in that semi (BTTS condition clearly met). Live capture of `18257865` (France vs England 3rd place) was considered and dropped — the demo must not depend on any live match. Verify the `game_finalised` `seq` against `/scores/historical/18241006` before building the keeper integration test. |
