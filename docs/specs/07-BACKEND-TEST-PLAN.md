# 07-BACKEND-TEST-PLAN

> **Track sentence (verbatim from archieve/tracks/track-02.md):** "Most fans watching the World Cup are doing it with a phone in their hand. TxLINE gives you live scores, real-time odds, and match events for all 104 games, the kind of data that until now only the big operators could access. We want to see what builders who are also fans do with it. The experiences that could exist here have not been built yet."
> **Persona (real fan):** Supavich — real fan, London hackathon builder. The group-chat promise nobody ever keeps: "if we win this one, I'll donate a tenner" — said every match, kept never. (Relatable anecdote, not a cited statistic.)
> **Wow moment:** Final whistle → keeper fires → SOL visibly moves + explorer link with Merkle proof — no human touched it.

Runner: `node --test` (zero extra deps). Money in every assertion is `BigInt` — a test that touches lamports with a float is itself a bug.

## Tier 1 — unit (pure logic, no credentials, no network)

Target: `server/conditions.mjs`, `server/store.mjs`. Runs on every commit.

| Test | Asserts |
|---|---|
| `team_wins` home/away | 2–1 home → true for `{team:"home"}`, false for `{team:"away"}`; draws → false both |
| `both_teams_score` | 1–1 → true; 2–0 → false; 0–0 → false |
| `total_goals_gte` boundary | n=3 with 2–1 → true (exact boundary); 1–1 → false; n=1 with 0–0 → false |
| `progress()` strings | Each template yields a plain-English progress line matching current stats |
| Store bigint round-trip | Pledge with `amountLamports: 100000000n` snapshots to disk and restores identical (`bigint`, not number/string) |
| Store rejects float money | Writing a pledge whose amount is a JS `number` throws |

### The invariant test — `test_lamport_conservation` (named explicitly, per SPECS.md)

`sum(active pledge lamports) + released lamports == total deposited lamports` — asserted after every scripted sequence: create ×3 → resolve one true (transferred) → resolve one false (failed, funds returned) → one still pending. Also: a simulated failed balance read makes totals raise ERROR — the test asserts it does NOT return zero (02 §4).

## Tier 2 — API (mocked externals)

Target: `server/routes.mjs` + `server/keeper.mjs` with a fake TxLINE client and a fake escrow (same interfaces as real). Runs on every commit.

| Test | Asserts |
|---|---|
| `GET /api/fixtures` happy + upstream down | 03 shape; upstream failure → `502 txline_unavailable`, never `{"fixtures":[]}` |
| `POST /api/pledges` validation matrix | Every 03 error code: `invalid_condition`, `invalid_amount`, `invalid_pubkey`, `fixture_not_found`, `duplicate_create_tx`, `fixture_already_finalised`, `create_tx_invalid` |
| `GET /api/pledges` totals | Wire lamports are decimal strings; invariant holds; forced balance-read failure → `500 balance_read_failed` |
| SSE relay | `score` / `match_event` / `pledge_update` / `game_finalised` / `heartbeat` events arrive with 03 shapes |
| Keeper happy path | Fake `game_finalised` + proof(true) → `condition_met` → escrow.release called once → `transferred`, `releaseTx` set |
| Keeper condition false | proof(false) → funds-return release to pledger → `failed(condition_not_met)` |
| **Idempotency** | Duplicate `game_finalised` + concurrent `POST /api/resolve/:id` on same pledge → exactly ONE release call; second resolve returns current record, `200` |
| Resolve too early | Fixture live → `409 fixture_not_finalised`, no state change |
| Proof unavailable | Proof fetch throws → state unchanged, retry scheduled, `502 proof_unavailable` on manual resolve — never "assume true" |

## Tier 3 — live integration (real TxLINE + real devnet — runs DAY 1 and at every checkpoint, not only at the end)

Credentials: real session via `scripts/connect.mjs` pattern (`_keys/txline-session.json`); keeper keypair with the funded devnet wallet (5.49792092 SOL verified). Script: `server/scripts/live-check.mjs` — run at every checkpoint and before recording the video.

| Check | Asserts |
|---|---|
| TxLINE auth | Guest JWT → API token round-trip against `https://txline-dev.txodds.com` succeeds |
| Fixtures live | Real fixtures fetch returns ≥1 fixture with 03-mappable fields |
| SSE live | Stream connects and delivers ≥1 event (or heartbeats) within 60s |
| Stat-validation | Merkle proof package retrievable for the seeded historical fixture |
| Escrow round-trip (the wow moment, for real) | Small pledge (10,000,000 lamports) through the ACTIVE escrow path (`ESCROW_MODE` as deployed): create tx confirms → forced resolve with real proof → release tx confirms on devnet → explorer URL printed. Balances re-read afterwards satisfy `test_lamport_conservation` on-chain (create/release network fees accounted separately — fees are not pledge money) |
| Replay end-to-end | Full replay of captured payloads drives keeper to a REAL devnet transfer, unattended |

Failure policy: a red tier-3 check blocks the "deployed" claim — root-cause it (02 §4: no silent defaults), never skip it. If TxLINE devnet is down, say so in the deliverable; do not fake the check green.
