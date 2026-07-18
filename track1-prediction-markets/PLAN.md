# LEGATO — Comprehensive Track 1 Plan

> **Track sentence:** "The flagship track. Markets, resolution and settlement built on verifiable World Cup data: outcome markets, oracle tooling, on-chain proof integrations."
>
> **Product:** LEGATO — multi-leg narrative markets settled by `validateStatV2`
> **Network target:** Solana **devnet** (demo + deploy); TxLINE free tier service level `1`
> **Written:** 2026-07-18 · **Ship window:** ~22h to London 12:00 BST Jul 19

---

## 0. Executive summary

Invent a Track 1 product that is **not** a generic 1X2 picker. Competitors already own binary `validate_stat` markets (ProofBall), micro-round YES/NO (KickTick), and admin-settled 1X2 pools (Whistle). LEGATO owns the white space: **multi-leg story markets compiled to `validateStatV2` strategies**, priced from live **StablePrice odds**, settled by **permissionless Merkle CPI**, with an **oracle tooling desk** judges can poke.

TxLINE is the live data backbone for fixtures, odds, scores, and proofs. Settlement is on Solana via CPI into `txoracle`.

---

## 1. Problem & positioning

### 1.1 Problem (with numbers judges can hear)

| Fact | Why it matters |
|---|---|
| Sportsbooks / prediction markets still resolve via admin keys or committees | Single point of failure / trust |
| TxLINE already anchors stats under daily Merkle roots on Solana | Settlement can be cryptographic, not political |
| `validateStatV2` supports multi-stat strategies | Almost no Track 1 demos use this — they stop at single `statKey` |
| Demo video carries judging (matches end before review) | Need an always-on historical settle loop |

### 1.2 Real anchor persona

**Primary:** London hackathon builder / small prediction-ops desk who wants to list **exotic multi-condition props** without hiring an oracle committee — and wants a Solana explorer link that proves payout.

**Secondary (addon):** Fan with a "story bet" (win + BTTS + totals) who hates three separate tickets.

### 1.3 Tagline & wow

- **Tagline:** Bet the story of the match — settle every leg in a single Merkle proof.
- **Wow (10s):** Multi-leg resolve tx → CPI `validateStatV2` → each leg PROVED → claim lands.

---

## 2. Track-sentence feature map

Every must-ship feature maps to the track sentence:

| Track clause | LEGATO feature | MVP? |
|---|---|---|
| **Markets** | Story markets (multi-leg YES/NO over a V2 strategy); single-leg props as degenerate case | Yes |
| **Resolution** | Permissionless `resolve` after `game_finalised`; void on cancelled fixture | Yes |
| **Settlement** | Escrow PDA + parimutuel claim | Yes |
| **Oracle tooling** | Strategy compiler UI + proof inspector (hashes, PDA, explorer) | Yes (inspector MVP; compiler lite) |
| **On-chain proof integrations** | CPI `validateStatV2`; fallback demo `validateStat` for 1-leg | Yes (V2 primary) |

---

## 3. Golden path MVP (must-ship before London 12:00 BST)

**One demo flow. Nothing else blocks recording.**

### 3.1 Golden path steps

| # | Actor | Action | System response |
|---|---|---|---|
| 1 | Operator / keeper | Create market for archived fixture + pinned V2 strategy (e.g. P1 goals > P2 goals AND total goals ≤ 4) | Market PDA + escrow; board shows legs |
| 2 | Fan A / Fan B | Stake YES / NO (devnet USDC or SOL) | Positions recorded; pool splits update |
| 3 | Anyone | After FT record available: fetch `/api/scores/stat-validation?statKeys=…` | Proof package cached |
| 4 | Anyone | `resolve(market, proof)` | CPI `validateStatV2`; market → RESOLVED |
| 5 | Winner | `claim` | Escrow pays pro-rata |
| 6 | Judge | Open proof receipt + Solana explorer | Sees CPI + Merkle path |

### 3.2 Instant-demo requirement (non-negotiable)

Live World Cup matches may be quiet during recording. MVP **must** include:

1. Seeded market against a **known historical fixture** (`/api/scores/historical/{fixtureId}` or fixed demo `fixtureId`/`seq` from TxLINE examples).
2. "⚡ Settle demo" button that runs the real proof path (not a mock boolean).
3. Optional: rotate seeded markets like ProofBall so the loop is repeatable for judges.

### 3.3 MVP scope checklist

- [ ] Devnet Anchor program: `create_market`, `stake`, `lock` (optional if create includes lock_ts), `resolve` (CPI V2), `claim`, `void` (fixture cancelled)
- [ ] Backend: TxLINE client (JWT + X-Api-Token), fixtures snapshot, scores snapshot/historical, stat-validation fetcher, keeper resolve job
- [ ] Frontend: board, market detail with leg list, stake UI, resolve/claim, proof receipt modal
- [ ] Deployed URL + program on explorer
- [ ] ≤5 min demo video covering golden path
- [ ] `SUBMISSION.md` draft with endpoints list + TxLINE feedback

### 3.4 Explicitly NOT in MVP

See §5 addon catalog and `BACKLOG.md`. Do not build AMM, squads, mobile, mainnet, or agent trading into the golden path.

---

## 4. Architecture

```
                    ┌─────────────────────────────────────┐
                    │  TxLINE (devnet)                     │
                    │  fixtures · odds · scores SSE        │
                    │  /scores/stat-validation             │
                    │  daily_scores_roots PDA (Merkle)     │
                    └──────────────┬──────────────────────┘
                                   │ REST + SSE
                                   ▼
┌──────────────┐    ┌──────────────────────────────────────┐
│  Next/Vite   │◄──►│  LEGATO API + Keeper                 │
│  Board · UX  │    │  ingest · strategy compile · resolve │
└──────┬───────┘    └──────────────────┬───────────────────┘
       │ wallet txs                     │ build proof ix
       ▼                                ▼
┌──────────────────────────────────────────────────────────┐
│  Solana devnet                                            │
│  legato program ──CPI──► txoracle.validateStatV2         │
│  market PDA · escrow vault · position accounts            │
└──────────────────────────────────────────────────────────┘
```

### 4.1 On-chain state machine

```
DRAFT → OPEN → LOCKED → RESOLVING → RESOLVED_YES | RESOLVED_NO → CLAIMED*
                              ↘ VOID (fixture cancelled / abandoned policy)
```

\* Claims may be progressive (per-user) after RESOLVED_*.

### 4.2 Market account (conceptual)

Pinned at creation (immutable after OPEN):

- `fixture_id`, `settle_seq_policy` (prefer `game_finalised` / statusId 100)
- `stat_keys: u16[]` (order is part of the contract)
- `strategy` blob matching `validateStatV2` discrete predicates (binary ops + singles)
- `lock_ts`, fee_bps, creator
- pool totals YES/NO, resolved bool, winning side

### 4.3 Settlement CPI (primary path)

1. Observe score record with real `seq` (≥ 1; never `0`) from snapshot / historical / stream.
2. Prefer record with `action=game_finalised` (`statusId=100`, `period=100`) for FT settlement.
3. `GET /api/scores/stat-validation?fixtureId=&seq=&statKeys=1,2,...`
4. Map response → `payload` + `strategy` (indexes refer to `statKeys` positions).
5. Derive `daily_scores_roots` PDA from `validation.summary.updateStats.minTimestamp` epoch day (u16 LE).
6. Program CPI: `validateStatV2(payload, strategy)` with compute budget ≥ 1_400_000.
7. On `true` / strategy pass → set winning side; on fail → reject tx (or map to NO depending on market encoding — **MVP encoding:** YES means "strategy predicates all hold"; resolve sets YES if CPI returns true, NO if false).

**Legacy fallback:** 1-leg markets may use `statKey` + `validateStat` for smaller CU / simpler demos — keep as escape hatch, not the pitch.

### 4.4 Fixture void path (oracle tooling)

- Cancelled fixtures: `GameState = 6` → `void` + refunds.
- Optional: `validateFixture` simulation via fixture validation endpoint + `ten_daily_fixtures_roots` PDA (view-only proof in oracle desk).

---

## 5. Full feature / addon catalog (ambitious)

Priorities: **P0** = MVP · **P1** = if golden path green before freeze · **P2** = backlog / interview flex · **P3** = post-hackathon

### 5.1 Markets

| ID | Feature | Priority | Notes |
|---|---|---|---|
| M1 | Multi-leg story YES/NO (`validateStatV2`) | **P0** | Core differentiator |
| M2 | Single-leg props (goals, cards, corners) | **P0** | Degenerate V2 or legacy validateStat |
| M3 | Instant historical demo market | **P0** | Always works for video |
| M4 | Period markets (H1 settle on HT using keys 1001/1002) | P1 | Soccer period prefixes |
| M5 | Template library ("Win + BTTS", "Clean sheet + under") | P1 | One-click create |
| M6 | Over/under totals via binary subtract strategies | P1 | `indexA/indexB` ops |
| M7 | ET / penalties narrative markets (6001/6002) | P2 | Needs PE phase awareness |
| M8 | Progressive in-play legs (lock mid-match) | P2 | Risk of seq timing |
| M9 | Parlay of *markets* (ticket of tickets) | P3 | Complexity bomb |
| M10 | Creator-custom free-text → LLM → strategy | P2 | Fun; verify compile correctness |

### 5.2 Pricing & liquidity

| ID | Feature | Priority |
|---|---|---|
| L1 | Parimutuel pools | **P0** |
| L2 | Opening fair odds from StablePrice snapshot | P1 |
| L3 | Live implied-prob ticker from `/api/odds/stream` | P1 |
| L4 | Seeded liquidity / faucet | **P0** |
| L5 | CPMM / LMSR AMM | P3 |
| L6 | Maker quotes that shadow TxLINE odds | P2 |
| L7 | Cross-market arb alerts (informational) | P3 — Track 3 adjacent; keep out of Track 1 product |

### 5.3 Resolution & settlement

| ID | Feature | Priority |
|---|---|---|
| S1 | Permissionless resolve with V2 CPI | **P0** |
| S2 | Claim winnings | **P0** |
| S3 | Void + refund on cancel | **P0** |
| S4 | Keeper auto-resolve on `game_finalised` SSE | P1 |
| S5 | 60s finality delay / confirm step | P2 |
| S6 | Dispute window + re-proof | P3 |
| S7 | Partial settle (H1 now, FT later) | P2 |
| S8 | Merkle proof receipt PDF / share card | P1 |

### 5.4 Oracle tooling (high Track-1 signal)

| ID | Feature | Priority |
|---|---|---|
| O1 | Proof inspector (stat keys, hashes, PDA, explorer) | **P0** |
| O2 | Strategy compiler (UI form → V2 strategy JSON) | **P0** lite |
| O3 | Predicate sandbox (simulate `.view()` before list) | P1 |
| O4 | Fixture proof viewer (`validateFixture`) | P2 |
| O5 | Odds proof viewer (`daily_batch_roots`) | P3 |
| O6 | Operator desk: create / lock / void console | P1 |
| O7 | TxLINE feedback log auto-export for submission | **P0** (doc) |

### 5.5 Fan / UX addons

| ID | Feature | Priority |
|---|---|---|
| U1 | Live scoreboard from scores SSE | P1 |
| U2 | Match desk (fixture + markets + odds) | P1 |
| U3 | Positions portfolio | P1 |
| U4 | Private squads / invite books | P2 — overlaps Whistle; only if time |
| U5 | Leaderboard | P2 |
| U6 | Notifications (webhook / Telegram) | P3 |
| U7 | Mobile PWA | P3 |

### 5.6 Infra / demo polish

| ID | Feature | Priority |
|---|---|---|
| I1 | Devnet faucet button | **P0** |
| I2 | Explorer deep links on every settle | **P0** |
| I3 | Replay mode from historical scores | P1 |
| I4 | Docker one-command demo | P2 |
| I5 | Mainnet toggle | P3 — do not chase |

---

## 6. Tech stack (decided)

| Layer | Choice | Why |
|---|---|---|
| Chain | Solana **devnet**, Anchor 0.30+/0.31 | Matches TxLINE examples / competitors |
| Oracle | TxLINE `txoracle` program `6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J` | Free tier SL=1 |
| Stake asset | Devnet USDC **or** native SOL | Pick one in hour-0 spike; USDC easier for "book" story |
| API | Node 20+ (Express/Hono) | SSE + keeper |
| Web | Vite + React (or Next if already fluent) | Fast board |
| Wallet | Wallet Adapter (Phantom) | Standard |
| Creds | Reuse `txline-setup/setup.mjs` → `~/.secrets/` | Already in repo |
| Deploy | Vercel/Fly frontend + small VPS/Fly API | Judges need a URL |

**Money:** Decimal/BN on-chain; never float for pools.

---

## 7. TxLINE endpoints (concrete)

Auth / activation (from `txline-setup` + World Cup free tier):

| Endpoint / instruction | Role |
|---|---|
| `POST {apiOrigin}/auth/guest/start` | Guest JWT |
| on-chain `subscribe(1, weeks)` | Free tier registration (needs SOL for fees) |
| `POST /api/token/activate` | `X-Api-Token` (message `${txSig}::${jwt}` when leagues=[]) |

Data (all need `Authorization: Bearer <jwt>` + `X-Api-Token: <token>`):

| Endpoint | LEGATO use |
|---|---|
| `GET /api/fixtures/snapshot` | Market universe / cancelled GameState |
| `GET /api/fixtures/snapshot?competitionId=` | Filter WC / friendlies |
| Fixture validation endpoint (see `fixture_validation_view_only.ts`) | Oracle desk void/proof |
| `GET /api/odds/snapshot/{fixtureId}` | Fair open prices |
| `GET /api/odds/updates/{epochDay}/{hour}/{interval}` | Backfill |
| `GET /api/odds/stream` (SSE) | Live implied probs |
| `GET /api/scores/snapshot/{fixtureId}` | Current score / seq discovery |
| `GET /api/scores/updates/{epochDay}/{hour}/{interval}` | Seq scan |
| `GET /api/scores/historical/{fixtureId}` | Demo replay (start 2w–6h ago window) |
| `GET /api/scores/stream` (SSE) | Live board + keeper triggers |
| `GET /api/scores/stat-validation?fixtureId&seq&statKeys=` | **V2 proof package** |
| `GET /api/scores/stat-validation?fixtureId&seq&statKey=` | Legacy 1-stat |

On-chain (TxLINE program):

| Method | Use |
|---|---|
| `validateStatV2` | Primary settlement CPI |
| `validateStat` | 1–2 stat fallback |
| `validateFixture` | Cancel/void tooling (view or CPI if integrated) |

PDA seeds (devnet):

| PDA | Seeds |
|---|---|
| Daily scores roots | `daily_scores_roots` + epochDay u16 LE |
| Daily batch roots | `daily_batch_roots` + epochDay u16 LE |
| Ten-day fixtures | `ten_daily_fixtures_roots` + alignedEpochDay u16 LE |

Hosts — **never mix**:

| | Devnet |
|---|---|
| API | `https://txline-dev.txodds.com/api/` |
| Guest | `https://txline-dev.txodds.com/auth/guest/start` |
| RPC | `https://api.devnet.solana.com` |
| TxL mint | `4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG` |

Runnable references: `subscription_free_tier.ts`, `subscription_scores_1stat.ts`, `subscription_scores_v2.ts`, `subscription_scores_v2a.ts`, `fixture_validation_view_only.ts` in TxLINE / tx-on-chain examples.

### 7.1 Soccer stat keys (settlement vocabulary)

| Key | Stat |
|---|---|
| 1 / 2 | P1 / P2 total goals |
| 3 / 4 | Yellows |
| 5 / 6 | Reds |
| 7 / 8 | Corners |
| +1000 / +3000 … | H1 / H2 period prefixes |

Example MVP strategy ("home wins on goals, regulation FT"):

- `statKeys=1,2`
- discrete binary: `indexA=0, indexB=1, op=subtract, predicate threshold=0 comparison=greaterThan` ⇒ P1 goals > P2 goals

Example story ("home wins AND both teams score"):

- Need goals > 0 each + home win → multi discrete predicates covering all stats exactly once (IncompleteStatCoverage if any unused).

---

## 8. Differentiation vs competitors (talk track)

1. **V2-native multi-leg** — ProofBall/KickTick pitch `validate_stat`; we pitch `validateStatV2` incomplete-coverage-safe strategies.
2. **Narrative tickets** — one escrow, many stats, one CPI.
3. **Odds backbone** — StablePrice opens the market; scores settle it (full TxLINE stack, not scores-only).
4. **Oracle desk** — proof inspector + strategy compiler as first-class Track-1 "oracle tooling."
5. **Period markets** — H1 keys (1001/1002) settle at HT; not only FT 1X2.
6. **Honest void path** — cancelled `GameState=6` refunds, not stuck pools.
7. **Always-on historical settle** — demo survives post-match silence.

---

## 9. Timeline to Jul 19 (compressed)

Assume **now ≈ Sat Jul 18 afternoon BST**. Binding deadline **Sun? → treat as Sat Jul 19 12:00 BST** per venue kickoff notes; also prepare global 23:59 UTC backup if local form already filed.

| Window | Focus | Exit criteria |
|---|---|---|
| T+0–2h | PREFLIGHT: TxLINE live read + one `stat-validation` + `.view()` validateStatV2 | Green smoke in PREFLIGHT.md |
| T+2–8h | Anchor: create/stake/resolve/claim + CPI | `e2e` script settles seeded market |
| T+8–14h | Backend keeper + API + frontend golden path | Deployed URL; faucet works |
| T+14–16h | Feature freeze → record demo video | ≤5 min Loom/YT |
| T+16–18h | Submission pack + TxLINE feedback + local Google form | Superteam Earn submitted |
| Buffer | Only P1 from catalog if video already good | No new market types after freeze |

**Kill clock rule:** If CPI not green by T+8h, ship single-stat `validateStat` market *styled* as 1-leg story, keep V2 compiler as "oracle tooling" view-only — still differentiate on tooling + odds, but admit the CPI cut in interview.

---

## 10. Demo video shot list (≤5 min)

| Time | Shot | On screen |
|---|---|---|
| 0:00–0:25 | Problem | "Admin keys resolve sports markets; we demand Merkle proofs" |
| 0:25–0:50 | Product one-liner | LEGATO tagline + board |
| 0:50–1:40 | Compose story market | Strategy compiler → 2–3 legs pinned |
| 1:40–2:20 | Stake both sides | Wallet txs; pools move |
| 2:20–3:20 | **WOW** Settle | Resolve → explorer CPI `validateStatV2` → legs PROVED |
| 3:20–3:50 | Claim + receipt | Proof inspector hashes |
| 3:50–4:20 | TxLINE named | Endpoints list overlay |
| 4:20–4:50 | Roadmap honesty | P1/P2 addons deferred |
| 4:50–5:00 | Links | Repo, URL, explorer |

---

## 11. Kill / defer list

| Idea | Decision | Why |
|---|---|---|
| Full AMM | **Kill for event** | Parimutuel ships faster; AMM eats CU + design |
| Mainnet | **Defer** | Devnet is enough for judging |
| Squads / social | **Defer** | Whistle already owns; Track-2 bleed |
| Agent auto-betting | **Kill (Track 3)** | Separate project only |
| LLM free-text markets | **Defer** | Compiler correctness risk under deadline |
| Sub-minute KickTick clones | **Kill** | Crowded; not our wedge |
| Admin override settle | **Kill** | Undercuts trustless pitch (void via fixture proof only) |
| Mobile native | **Defer** | Responsive web only |

---

## 12. Risks & mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| No live match during demo | High | Historical fixture + instant settle |
| `validateStatV2` CU / IncompleteStatCoverage bugs | Med | Spike hour-0; fallback validateStat |
| Devnet IDL drift | Med | Fetch IDL on-chain like `txline-setup`; pin working IDL |
| Proof timestamp / wrong PDA epoch day | High (common) | Always use proof `minTimestamp`; checklist from TxLINE docs |
| seq=0 mistakes | High | Only use observed Seq from records |
| Auth 401/403 network mix | Med | Devnet-only config object; never dual-host |
| Gambling compliance | Med | Demo / play-money framing; T&C; jurisdiction note in submission |
| Scope creep from addon catalog | Certain | Spec lock = MVP only; addons → BACKLOG |
| Same project dual-track DQ | Med | Strict SUPA/Track-2 boundary in README |

---

## 13. Submission requirements checklist

From listing / RUBRIC patterns:

- [ ] Demo video ≤5 min
- [ ] Public GitHub repo
- [ ] Deployed site or devnet endpoint judges can use
- [ ] Brief tech docs (this PLAN + endpoints table)
- [ ] TxLINE API feedback field filled (friction log)
- [ ] Local London eligibility form (if chasing local $5k)
- [ ] Human-owned Superteam Earn submission

---

## 14. Open questions (resolve in PREFLIGHT, not during UI)

1. Stake mint: SOL vs fake USDC — pick after faucet spike.
2. Exact historical fixtureId available on **devnet** scores historical window today.
3. Whether CPI return-data bool encoding matches our YES/NO mapping (test with equality predicate first).
4. Confirm London deadline date with venue board (transcript ambiguity Sun vs Sat).

---

## 15. Success definition

Judges can explain LEGATO in one sentence after 3 minutes of video: **"Multi-leg World Cup bets that pay only when TxLINE's validateStatV2 proof says every leg is true."** Explorer link proves it. Addon catalog shows ambition without blocking the ship.
