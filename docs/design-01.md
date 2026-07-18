# Design Document — Social Commitment Engine

## 1. Overview

The Social Commitment Engine is an on-chain protocol on Solana devnet that lets fans lock conditional pledges against World Cup match outcomes. If the stated condition is met at full time, funds go to a pre-chosen beneficiary. If not, members reclaim their funds. Settlement is driven by TxLINE's Merkle proof — no admin, no counter-party.

This document translates `req-01.md` into a concrete build plan: account layouts, instruction interfaces, keeper design, indexer schema, and frontend component map.

---

## 2. Goals and Non-Goals

### Goals
- Full individual commitment loop: create → resolve → execute/claim
- Group/DAO: create → join/withdraw → resolve → execute/claim
- Keeper: SSE + polling fallback → auto-resolve on `game_finalised`
- Public board (requires off-chain indexer)
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
│  │ Create Flow  │  │ Public Board  │  │ In-Play Card   │  │ Feed / Feed │ │
│  │ (wallet req) │  │ (no wallet)   │  │ (live scores)  │  │ History     │ │
│  └──────┬───────┘  └───────┬───────┘  └───────┬────────┘  └──────┬──────┘ │
│         │                  │                  │                   │         │
│         ▼                  ▼                  ▼                   ▼         │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ Escrow Interface (ESCROW_MODE abstraction)                              ││
│  │  ├─ on-chain:  Anchor CPI to Commitment program                        ││
│  │  └─ keeper-custody: REST calls to Keeper API                           ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │
             ┌───────────────────────┼────────────────────┐
             ▼                       ▼                    ▼
   ┌──────────────────┐   ┌──────────────────┐  ┌────────────────┐
   │  Anchor Program  │   │  Keeper (Node.js) │  │  Indexer       │
   │  (Solana devnet) │   │  ─────────────── │  │  (Postgres +   │
   │                  │   │  SSE + polling    │  │  event listener│
   │  Commitment PDA  │   │  → auto-resolve   │  │  → query API)  │
   │  Vault PDA       │◄──│  → emit feed evts │  │                │
   │                  │   │                  │  │                │
   └──────────────────┘   └──────────────────┘  └────────────────┘
             ▲                       ▲
             │                       │
             └───────────────────────┘
                     TxLINE API
              (fixtures / scores / proofs)
```

---

## 4. On-Chain Program (Anchor)

### 4.1 Account: `Commitment`

```rust
#[account]
pub struct Commitment {
    pub fixture_id:         u64,
    pub kickoff_ts:         i64,        // Unix timestamp; enforced at join/withdraw
    pub condition_template: u8,         // 0 = BTTS, 1 = TotalGoals, 2 = TeamWins
    pub condition_param:    u64,        // N for TotalGoals; team selector for TeamWins
    pub beneficiary:        Pubkey,
    pub vault:              Pubkey,     // PDA holding lamports
    pub founder:            Pubkey,
    pub status:             CommitmentStatus,
    pub member_count:       u32,
    pub members:            [MemberEntry; 500],  // pre-allocated
    pub bump:               u8,
}

#[derive(Clone, Copy, AnchorSerialize, AnchorDeserialize)]
pub struct MemberEntry {
    pub wallet:        Pubkey,          // zero = empty slot
    pub deposit_lamports: u64,
    pub withdrawn:     bool,
    pub claimed:       bool,
}

#[derive(Clone, Copy, AnchorSerialize, AnchorDeserialize, PartialEq)]
pub enum CommitmentStatus {
    Open,
    ResolvedYes,
    ResolvedNo,
    Executed,
    Refunded,
    Void,
    Closed,     // last member withdrew before kickoff
}
```

**Account size estimate:**
- Fixed fields: ~150 bytes
- 500 × MemberEntry (32 + 8 + 1 + 1 = 42 bytes): 21,000 bytes
- Total: ~21,200 bytes → ~0.15 SOL rent

**PDA seeds:** `["commitment", fixture_id (LE u64), founder_pubkey]`

### 4.2 Account: `Vault`

A simple system-owned PDA that holds lamports. No token accounts needed.

**PDA seeds:** `["vault", commitment_pubkey]`

Funds flow:
- `create` / `join`: depositor → vault via `system_program::transfer`
- `resolve` YES: vault → beneficiary via `system_program::transfer`
- `claim_refund`: vault → member; if last claimer, vault account closed → rent to claimer

### 4.3 Instructions

#### `create_commitment`

**Accounts:** `[signer=founder, writable=commitment, writable=vault, system_program]`

**Args:** `fixture_id: u64, kickoff_ts: i64, condition_template: u8, condition_param: u64, beneficiary: Pubkey, deposit_lamports: u64`

**Logic:**
1. Validate `condition_template` ∈ {0, 1, 2}; validate `condition_param` where needed (TeamWins: 0 or 1 for home/away).
2. Validate `kickoff_ts` is in the future.
3. Allocate and initialize Commitment PDA with space for 500 members.
4. Record founder as `members[0]` with `deposit_lamports`.
5. Transfer `deposit_lamports` from founder to vault.
6. Emit `CommitmentCreated { commitment, fixture_id, condition, beneficiary, deposit_lamports }` event.

**Errors:** `ConditionTemplateInvalid`, `KickoffInPast`, `ZeroDeposit`

---

#### `join`

**Accounts:** `[signer=member, writable=commitment, writable=vault, system_program]`

**Args:** `deposit_lamports: u64`

**Logic:**
1. Check `Clock::get().unix_timestamp < commitment.kickoff_ts` — reject with `KickoffPassed` if not.
2. Check `commitment.status == Open` and `commitment.member_count < 500`.
3. Check member is not already in `members` (and has not withdrawn — re-join prohibited).
4. Add member to next empty slot; increment `member_count`.
5. Transfer `deposit_lamports` from member to vault.
6. Emit `MemberJoined { commitment, member, deposit_lamports }`.

**Errors:** `KickoffPassed`, `MemberLimitReached`, `AlreadyMember`, `ZeroDeposit`

---

#### `withdraw`

**Accounts:** `[signer=member, writable=commitment, writable=vault, system_program]`

**Args:** none

**Logic:**
1. Check `Clock::get().unix_timestamp < commitment.kickoff_ts` — reject with `KickoffPassed`.
2. Find member in `members`; verify `!withdrawn` and `!claimed`.
3. Mark `member.withdrawn = true`; decrement `member_count`.
4. Transfer `member.deposit_lamports` from vault to member.
5. If `member_count == 0`: set `status = Closed`. Emit `CommitmentClosed`.
6. Emit `MemberWithdrew { commitment, member, deposit_lamports }`.

**Errors:** `KickoffPassed`, `MemberNotFound`, `AlreadyWithdrawn`

---

#### `resolve`

**Accounts:** `[signer=resolver (any), writable=commitment, writable=vault, writable=beneficiary (if YES), daily_scores_pda (TxLINE), txline_program, system_program]`

**Args:** `proof: StatValidationInput, strategy: NDimensionalStrategy`

**Logic:**
1. Check `commitment.status == Open`.
2. CPI `validateStatV2(proof, strategy)` on TxLINE program → returns `bool`.
3. If `true`:
   - Set `status = ResolvedYes → Executed`.
   - Transfer entire vault balance to `beneficiary` atomically.
   - Emit `CommitmentExecuted { commitment, beneficiary, amount_lamports }`.
4. If `false`:
   - Set `status = ResolvedNo → Refunded`.
   - Emit `CommitmentRefunded { commitment }` (no fund movement here).

**Errors:** `NotOpen`, `ProofInvalid` (propagated from CPI)

> Idempotency: Any state other than `Open` causes `NotOpen` — subsequent resolve calls fail cleanly.

---

#### `claim_refund`

**Accounts:** `[signer=member, writable=commitment, writable=vault, system_program]`

**Args:** none

**Logic:**
1. Check `commitment.status ∈ {Refunded, Void}`.
2. Find member; check `!withdrawn && !claimed`.
3. Mark `member.claimed = true`.
4. Transfer `member.deposit_lamports` from vault to member.
5. If all non-withdrawn members have claimed: close vault PDA, transfer rent reserve to this claimer.
6. Emit `RefundClaimed { commitment, member, amount_lamports }`.

**Errors:** `NotRefundable`, `MemberNotFound`, `AlreadyClaimed`

---

#### `void_fixture`

**Accounts:** `[signer=any, writable=commitment, ten_daily_fixtures_pda (TxLINE), txline_program]`

**Args:** `fixture_snapshot, fixture_summary, sub_tree_proof, main_tree_proof`

**Logic:**
1. Check `commitment.status == Open`.
2. CPI `validateFixture(...)` — verify `gameState == 6` (cancelled).
3. Set `status = Void`.
4. Emit `CommitmentVoided { commitment, reason: "fixture_cancelled" }`.

**Errors:** `NotOpen`, `FixtureNotCancelled`

---

#### `void_timeout`

**Accounts:** `[signer=member, writable=commitment]`

**Args:** none

**Logic:**
1. Check `commitment.status == Open`.
2. Check `Clock::get().unix_timestamp >= commitment.kickoff_ts + 7 * 86400`.
3. Set `status = Void`.
4. Emit `CommitmentVoided { commitment, reason: "timeout" }`.

**Errors:** `NotOpen`, `TimeoutNotReached`

---

### 4.4 State Machine

```
OPEN
 │
 ├─ resolve (YES) ──────────────► EXECUTED   (vault → beneficiary, terminal)
 │
 ├─ resolve (NO) ───────────────► REFUNDED   (members claim individually)
 │                                    │
 │                                    └─ claim_refund (each member) → REFUNDED
 │                                         └─ last claim → vault closed
 │
 ├─ void_fixture / void_timeout ─► VOID      (members claim individually)
 │
 └─ withdraw (last member) ──────► CLOSED    (terminal, empty vault)
```

No state is reversible. EXECUTED, REFUNDED (fully drained), VOID (fully drained), and CLOSED are all terminal.

---

## 5. Condition Templates

Three fixed templates map to `validateStatV2` strategy payloads. The template is stored as a `u8` + `u64` param on-chain; the keeper and frontend reconstruct the strategy at resolve time.

### Template 0: Both Teams Score (BTTS)

**Human:** "Both teams score"
**Stat keys:** `[1, 2]` (P1 goals, P2 goals)
**Strategy:**
```typescript
discretePredicates: [
  { single: { index: 0, predicate: { threshold: 0, comparison: { greaterThan: {} } } } },
  { single: { index: 1, predicate: { threshold: 0, comparison: { greaterThan: {} } } } },
]
```

### ~~Template 1: Total Goals ≥ N~~ — Descoped

**Decision:** This template is removed from the hackathon build. Only BTTS (template 0) and TeamWins (template 2) ship.

**Rationale:** `validateStatV2` supports two predicate forms: `single` (one stat, one threshold) and `binary` (subtract two stats, one threshold). Neither expresses addition. "Total goals ≥ N" requires `stat[0] + stat[1] ≥ N`, which cannot be expressed as a single predicate in either form.

Three workarounds were considered and rejected:

1. **Enumerate all valid (P1, P2) splits off-chain, submit the one that satisfies N.** Breaks the on-chain proof guarantee — the resolver chooses which split to submit, introducing an off-chain trust dependency. Violates FR-6.3.

2. **Use a conservative pair of single predicates** (`P1 ≥ ⌈N/2⌉ AND P2 ≥ ⌊N/2⌋`). This is strictly tighter than the actual condition (a 3–0 scoreline satisfies "total ≥ 3" but fails this predicate). The condition pledgers see would not match what the contract verifies.

3. **Switch to `validateStatV3` multiproof.** V3 supports 4+ stat keys and a different proof structure. It would allow fetching `1, 2, 3001, 3002` (FT + ET goals for both teams) and running a custom multi-leg strategy. This is architecturally sound but adds proof-construction complexity, a new endpoint, and a new IDL type — invisible to a 5-minute demo video and high build cost relative to the signal it adds.

BTTS and TeamWins together cover the two conditions fans most commonly pledge on. The template set is designed to be expandable (FR-2.3); Total Goals ≥ N can be added post-hackathon using V3 once the core pipeline is proven.

### Template 2: Team Wins (on goals; ET counts; shootout excluded)

**Human:** "Home team wins" or "Away team wins"
**Stat keys:** `[1, 2]` (P1/P2 total goals, ET included, keys 6001/6002 excluded)
**UI disclosure:** "Wins on goals — extra time counts; penalty shootout result does not satisfy this condition."
**condition_param:** `0` = home (P1), `1` = away (P2)

**Strategy (home wins):**
```typescript
discretePredicates: [{
  binary: { indexA: 0, indexB: 1, op: { subtract: {} }, predicate: { threshold: 0, comparison: { greaterThan: {} } } }
}]
```

**Strategy (away wins):** swap `indexA` and `indexB`.

---

## 6. TxLINE Integration

### 6.1 Auth

- Obtain guest JWT via `POST /auth/guest/start`
- Subscribe on-chain (service level 1, World Cup free tier)
- Activate API token — store `jwt` + `apiToken` in keeper env
- Use axios interceptor for JWT auto-renewal on 401

### 6.2 Proof construction for `resolve`

```
1. Keeper receives game_finalised (SSE or poll)
2. Read seq from event payload (never default to 0)
3. GET /scores/stat-validation?fixtureId=&seq=&statKeys=1,2
4. Build StatValidationInput from response
5. Derive dailyScoresPda: epochDay from val.summary.updateStats.minTimestamp (NOT Date.now())
6. Build NDimensionalStrategy from commitment.condition_template + condition_param
7. CPI validateStatV2 → resolve instruction
```

### 6.3 Proof construction for `void_fixture`

```
1. Detect gameState=6 via /fixtures/updates polling
2. GET /fixtures/validation?fixtureId=&timestamp=
3. Derive tenDailyFixturesRootsPda (10-day window)
4. CPI validateFixture → void_fixture instruction
```

### 6.4 Stat key reference

| Template | statKeys | Proof endpoint |
|---|---|---|
| BTTS | `1,2` | `/scores/stat-validation` (V2) |
| TeamWins | `1,2` | `/scores/stat-validation` (V2) |
| TotalGoals ≥ N | — | descoped; see Section 5 |
| In-play display | `1,2,5,6` | display only, no CPI |

---

## 7. Keeper Design

The keeper is a Node.js process with two independent channels for detecting `game_finalised`.

### 7.1 Boot sequence

```
1. Load env: ANCHOR_WALLET, ANCHOR_PROVIDER_URL, TXLINE_JWT, TXLINE_API_TOKEN
2. If REPLAY_FIXTURE_ID set → enter replay mode (skip steps 3–4)
3. Start SSE subscription: subscribeScores()     ← BUG-04 fix: must call at boot
4. Start poll loop: every 30s scan /scores/updates
5. Load active commitments from on-chain program (or indexer)
6. Enter event loop
```

### 7.2 SSE channel

```typescript
function subscribeScores() {
  const es = new EventSource(`${API_BASE_URL}/scores/stream`, { fetch: authFetch });
  es.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.action === 'game_finalised' && data.statusId === 100) {  // BUG-01 fix
      handleFinalised(data.FixtureId, data.seq);
    }
    lastSeenId = event.lastEventId;
  };
  es.onerror = () => { es.close(); setTimeout(subscribeScores, 3000); };
}
```

### 7.3 Polling channel (fallback)

```typescript
async function pollScores() {
  // Scan last 2 hours of 5-min intervals
  for each tracked fixture:
    scan /scores/updates/{epochDay}/{hour}/{interval}
    if record.action === 'game_finalised' && not already resolved:
      handleFinalised(record.FixtureId, record.seq)
}
setInterval(pollScores, 30_000);
```

### 7.4 `handleFinalised`

```typescript
async function handleFinalised(fixtureId, seq) {
  const commitments = await getCommitmentsForFixture(fixtureId);
  for (const c of commitments) {
    if (c.status !== 'Open') continue;  // idempotent — BUG-04 note
    const proof = await fetchStatValidationProof(fixtureId, seq, [1, 2]);
    const strategy = buildStrategy(c.conditionTemplate, c.conditionParam);
    try {
      await sendResolveTransaction(c.pubkey, proof, strategy);
      // Only emit condition_met AFTER tx confirms  ← BUG-03 fix
      emitFeedEvent({ type: 'resolved', commitment: c, conditionMet: true });
    } catch (e) {
      if (isAlreadyResolved(e)) return;  // idempotent — BUG-07 note
      logger.error('resolve failed', e);
    }
  }
}
```

### 7.5 Replay mode

When `REPLAY_FIXTURE_ID` is set:
- Skip SSE subscription
- Poll `/scores/historical/${REPLAY_FIXTURE_ID}` at boot
- Feed the result into `handleFinalised` directly
- Frontend receives same events via internal event bus — no frontend changes needed

### 7.6 Keeper API (REST, internal)

Used by frontend and indexer to subscribe to feed events:

| Endpoint | Purpose |
|---|---|
| `GET /api/feed` | SSE stream of resolution events |
| `GET /api/commitments/:fixtureId` | Active commitments for a fixture |
| `POST /api/resolve/:commitmentId` | Manual resolve trigger (fallback) |

---

## 8. Off-Chain Indexer

### 8.1 Purpose

Solana accounts can't be queried like a database. The indexer listens to program events and maintains a Postgres database that powers the public board and claim notifications.

### 8.2 Schema

```sql
CREATE TABLE commitments (
  pubkey            TEXT PRIMARY KEY,
  fixture_id        BIGINT NOT NULL,
  kickoff_ts        BIGINT NOT NULL,
  condition_template SMALLINT NOT NULL,
  condition_param   BIGINT NOT NULL,
  condition_label   TEXT NOT NULL,    -- "Both teams score", "Home team wins", etc.
  beneficiary       TEXT NOT NULL,
  founder           TEXT NOT NULL,
  status            TEXT NOT NULL,    -- Open | ResolvedYes | Refunded | Void | etc.
  member_count      INT NOT NULL DEFAULT 0,
  total_lamports    BIGINT NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL,
  resolved_at       TIMESTAMPTZ,
  settlement_tx     TEXT            -- Solana tx signature
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

CREATE INDEX idx_commitments_fixture ON commitments(fixture_id);
CREATE INDEX idx_commitments_status ON commitments(status);
CREATE INDEX idx_members_wallet ON commitment_members(wallet);
```

### 8.3 Event listener

Listen to program logs via Solana `connection.onLogs` (or Helius webhooks for reliability):

| Program event | Indexer action |
|---|---|
| `CommitmentCreated` | INSERT into commitments + members |
| `MemberJoined` | INSERT into commitment_members; UPDATE total_lamports |
| `MemberWithdrew` | UPDATE commitment_members.withdrawn; UPDATE total_lamports |
| `CommitmentExecuted` | UPDATE status=Executed, settlement_tx |
| `CommitmentRefunded` | UPDATE status=Refunded |
| `RefundClaimed` | UPDATE commitment_members.claimed |
| `CommitmentVoided` | UPDATE status=Void |
| `CommitmentClosed` | UPDATE status=Closed |

### 8.4 Query API

```
GET /api/board?sort=total_lamports|member_count&status=Open&fixture_id=
GET /api/claims?wallet=<pubkey>          -- all open claims for a wallet
GET /api/commitment/:pubkey              -- full detail
GET /api/feed                            -- SSE: resolution events (proxied from keeper)
```

---

## 9. Frontend (Next.js)

### 9.1 Pages and components

```
/                         → Public board (no wallet needed)
  ├─ CommitmentCard       fixture + condition + status + members + amount
  ├─ BoardFilters         sort/filter by fixture, condition, status, amount
  └─ LiveFeed             SSE feed of recent resolutions

/fixture/:id              → Fixture detail
  ├─ CreateCommitmentForm (wallet required)
  │   ├─ ConditionPicker  fixed template selector
  │   ├─ BeneficiaryInput address + warning copy
  │   └─ DepositInput     SOL amount
  └─ CommitmentList       commitments for this fixture

/commitment/:pubkey       → Commitment detail
  ├─ InPlayCard           live score + condition status (FR-15)
  │   ├─ LiveScore        SSE-updated
  │   ├─ ConditionStatus  tracking / met / resolved
  │   └─ EventLog         goals/cards as they happen
  ├─ MemberList           member count + total pledged
  ├─ ResolveButton        (any wallet, after game_finalised)
  └─ ClaimRefundButton    (member only, after REFUNDED/VOID)

/claims                   → My pending claims (wallet required)
  └─ ClaimList            all open refunds for connected wallet
```

### 9.2 Escrow interface abstraction

```typescript
// Single interface regardless of ESCROW_MODE
interface EscrowInterface {
  createCommitment(params: CreateParams): Promise<string>;  // → tx sig
  joinCommitment(pubkey: string, lamports: number): Promise<string>;
  withdraw(pubkey: string): Promise<string>;
  resolve(pubkey: string): Promise<string>;
  claimRefund(pubkey: string): Promise<string>;
  voidFixture(pubkey: string): Promise<string>;
}

// on-chain: sends Anchor transactions via wallet adapter
// keeper-custody: POST to keeper API
const escrow: EscrowInterface =
  ESCROW_MODE === 'on-chain' ? new AnchorEscrow() : new KeeperEscrow();
```

### 9.3 Wallet adapter

- Supported: Phantom, Solflare, Backpack (via `@solana/wallet-adapter-react`)
- Connection required for all write actions
- Board browsable without connection
- Persistent wallet address display + disconnect button in header

### 9.4 In-play data source

- SSE from keeper's `/api/feed` for resolution events
- SSE from `GET /scores/stream` proxied through keeper for live score updates
- Condition status derived from live score data + stored condition template
- Never derived from off-chain computation alone (FR-15.5)

---

## 10. Key Flows

### 10.1 Individual commitment — YES path

```
Fan → CreateCommitmentForm
  → EscrowInterface.createCommitment()
  → Anchor: create_commitment (PDA init, vault funded)
  → Indexer: CommitmentCreated event → DB

[Match in progress]
  → InPlayCard polling keeper SSE for score updates
  → ConditionStatus shows "tracking" → "met" as match unfolds

[game_finalised via SSE]
  → Keeper handleFinalised()
  → fetchStatValidationProof(seq from event)
  → buildStrategy(BTTS or TeamWins)
  → sendResolveTransaction() → lands on-chain
  → TX confirms → emitFeedEvent(condition_met: true)   ← BUG-03 fix
  → Anchor: status = Executed, vault → beneficiary

LiveFeed shows: "$50 released to charity — Argentina vs France"
Explorer link → tx sig
```

### 10.2 Group DAO — NO path

```
Founder → createCommitment()
Members → join() (before kickoff_ts)
         → OR withdraw() if they change mind

[kickoff passes — join/withdraw both reject KickoffPassed]

[game_finalised]
  → Keeper → resolve() → NO path
  → Anchor: status = Refunded (no fund movement)
  → Indexer: CommitmentRefunded event

[Member sees claim notification in header]
  → ClaimRefundButton → claimRefund()
  → Anchor: transfer deposit_lamports to member
  → Last member: vault account closed, rent → claimer
```

### 10.3 Void — timeout

```
[7+ days after kickoff_ts with no resolution]
  → Any wallet clicks "Force Void" (UI shows if eligible)
  → voidTimeout() instruction
  → Anchor: checks clock >= kickoff_ts + 7*86400
  → status = Void
  → Members can claim_refund individually
```

---

## 11. Build Order

### Phase 1 — Individual commitment core (target: first working demo)

1. **Anchor program**: `create_commitment`, `resolve` (YES + NO paths), `claim_refund`
   - Condition templates: BTTS + TeamWins (skip TotalGoals)
   - No group join/withdraw yet — `members[0]` is founder only
2. **Keeper**: boot with SSE subscription + polling fallback; `handleFinalised` → resolve tx
   - **Fix BUG-01, BUG-02, BUG-03, BUG-04** before first test
   - Replay mode via `REPLAY_FIXTURE_ID`
3. **Frontend**: create flow, commitment detail, resolve button, explorer link
4. **Indexer**: basic event listener + board query (can stub with on-chain account scan first)

Kill clock: if keeper not firing cleanly by hour 8, log `game_finalised` manually and test the resolve tx.

### Phase 2 — Group DAO (additive once Phase 1 is green)

5. **Anchor**: `join`, `withdraw`, member cap enforcement, pro-rata `claim_refund`
6. **Frontend**: join button, member list, withdraw button, pending claims page
7. **Indexer**: member join/withdraw events

### Phase 3 — Polish (if time)

8. `void_fixture` (validateFixture CPI)
9. `void_timeout` instruction
10. In-play pledge card (FR-15) — live score + condition status
11. Live settlement feed in real time
12. Pending claim notifications (FR-12) header badge

---

## 12. Bug Fixes Required Before First Demo

All four bugs in `build-bugs.md` must be fixed before the proof pipeline can work:

| Bug | File | Fix |
|---|---|---|
| BUG-01: GameState=3 mapped to finalised | `server/txline.mjs` | Only fire on `action=game_finalised` && `statusId=100` |
| BUG-02: `seq ?? 0` | `server/keeper.mjs` | Read seq from event; throw if missing |
| BUG-03: `condition_met` emitted before evaluation | Keeper/feed emitter | Emit only after resolve tx confirms |
| BUG-04: `subscribeScores` never called | Keeper boot | Call at startup; replay is dev-only flag |

---

## 13. Non-Functional Checklist

| NFR | Design coverage |
|---|---|
| NFR-1 Trustless | No admin key in resolve path; validateStatV2 CPI is the only oracle |
| NFR-2 Permissionless | resolve, void_fixture, void_timeout accept any signer |
| NFR-3 Transparency | All state on-chain; indexer is read-only |
| NFR-4 No counter-party | Beneficiary set at creation; no opposing bet structure |
| NFR-5 Devnet | All configs point to devnet RPC + TxLINE devnet host |
| NFR-6 ESCROW_MODE abstraction | Frontend uses EscrowInterface; mode switchable via env var |

---

## 14. Open Questions

| # | Question | Recommended resolution |
|---|---|---|
| Q1 | Does "Total Goals ≥ N" template fit in a single validateStatV2 call? | **Resolved — descoped.** validateStatV2 supports single-stat and binary-subtract predicates only; addition is not expressible. Three workarounds (split enumeration, conservative predicate pair, V3 multiproof) were evaluated and rejected for hackathon scope. See Section 5. |
| Q2 | Indexer: use Helius webhooks or `connection.onLogs`? | `connection.onLogs` for hackathon simplicity; Helius for prod reliability. |
| Q3 | Beneficiary registry — trusted addresses only or open? | Open addresses for hackathon; show UI warning. Curated registry as post-hackathon feature. |
| Q4 | Minimum deposit for group join (sybil resistance)? | Set 0.01 SOL minimum at join instruction. Soft UX guard — not a protocol invariant. |
| Q5 | `ESCROW_MODE` for hackathon demo — which mode leads? | Start with keeper-custody (simpler to build); wire on-chain path once keeper is stable. |
