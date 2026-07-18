# TxODDS / TxLINE — Sponsor Tech Brief

Everything useful mined from the sponsor org (`github.com/txodds`), 2026-07-18. Only one repo matters: **[`txodds/tx-on-chain`](https://github.com/txodds/tx-on-chain)** (updated kickoff day; the rest of the org is stale infra forks). Hosted docs: <https://txline.txodds.com/documentation/quickstart> · OpenAPI: <https://txline.txodds.com/docs/docs.yaml> · Discord: <https://discord.com/invite/txodds> · Contact: hello@txodds.com

## TL;DR

- **TxLINE = hybrid Solana oracle for sports data.** Off-chain REST + SSE API (fixtures, odds, scores) gated by an **on-chain subscription tx**; every record is anchored on Solana as Merkle roots so any single record can be **cryptographically proven** via a `validate*` instruction (free read-only `.view()` simulation).
- **World Cup data is FREE** (service levels 1 = 60s delay, 12 = real-time on mainnet; devnet level 1 is effectively real-time). No TxL token purchase, no card, **no rate limits**. You only need SOL for the subscribe tx fee (devnet airdrop works).
- Repo ships **runnable end-to-end example scripts** (subscribe → activate → stream → validate) for devnet and mainnet, plus IDL + TS types. Most integration code is copy-paste.
- **Real World Cup 2026 fixture IDs are published** (final: Spain vs Argentina, ID `18257739`). Historical replay covers matches 6h–2wk old — quarter-finals and semis are replayable during the hackathon.

## 1. Hackathon terms + track brief (T&C from `documentation/legal/hackathon-terms.mdx`; brief from Superteam Earn listing)

**Deadlines (two separate ones!): — WE TARGET THE LOCAL ONE: Jul 19 12:00 BST (11:00 UTC)**
- **London IRL local pool: Sat Jul 19, 12:00 BST** ($5k local pool, Google form — per template kickoff notes). ← primary target; everything done by then.
- Global Superteam track: closes Sat Jul 19, 23:59 UTC — hitting the local deadline auto-qualifies timing for this too; submit to both. Winner announcement Jul 29 15:00 UTC, after live interview rounds.
- Free premium data access ends Jul 19 23:59 UTC.

**Tracks (enter multiple, win max ONE prize):**
| Track | Total | 1st / 2nd / 3rd | Subs (Jul 18 pm) |
|---|---|---|---|
| **Consumer and Fan Experiences — PRIMARY** (idea-01, see `docs/tracks/track-02-consumer-fan.md`) | 16k USDT | 10,000 / 4,000 / 2,000 | ~90 |
| **Prediction Markets and Settlement — SECONDARY** (same engine, infra framing) | 18k USDT | 12,000 / 4,000 / 2,000 | ~96 |
| Trading Tools and Agents | 16k USDT | 10,000 / 4,000 / 2,000 | ~78 |

Consumer-track extra requirement: **sign up through Solana** (wallet sign-in) + product must work during a match. Judging: fan UX, real-time responsiveness, originality, monetization path, completeness — demo video heaviest.

**Trading track judging criteria (REFERENCE ONLY — we're on Consumer track now):**
1. **Core functionality & data ingestion** — runs and executes decisions on live or simulated TxLINE feeds.
2. **Autonomous operation** — zero manual input once deployed.
3. **Logic & code architecture** — clean, deterministic, well-documented, mathematically/strategically defensible.
4. **Innovation & novelty.**
5. **Production readiness** — could a professional trading desk deploy it.
- **Demo video weighs heaviest** — matches end before review, judges see the video, not live activity.

**Submission requirements (Trading track):**
- Demo video ≤ 5 min (Loom/YouTube): problem → live walkthrough → how TxLINE powers backend. *Absolute requirement to pass screening.*
- Public GitHub repo.
- Working deployed link OR functional API/devnet endpoint judges can test.
- Brief technical doc: core idea, highlights, **list of TxLINE endpoints used**.
- Feedback section: what you liked / where you hit friction with the API.
- **Must integrate TxLINE data as a live input.** Running agent/tool (live or devnet). Pitch-deck-only / mockup-only = auto-disqualified.

**Track's own starter ideas (signal of what sponsor wants):** Sharp Movement Detector (poll odds every 60s, flag shifts, track predictive hit rate) · Agent vs Agent Arena (opposite strategies, on-chain settlement) · In-Play Market Maker (quotes buy/sell on in-play outcomes, adjusts from feed).

**Binding T&C:**
- Organiser TXODDS Services LLC (Illinois), run with Superteam Earn. Teams **≤ 3**, named leader, 18+. Prize paid in stablecoin; gas deducted; winner affidavit within 30 days or forfeit; prize needs a real person/entity eligible on Earn.
- **Built during the hackathon**; pre-existing code only if public + attributed.
- Agent-authorship tension: brief says "open to AI agents", T&C §5.1 says human-created/submitted, may disqualify entries materially controlled by agents (flagged unresolved in listing comments). Safe course: human owns, submits, and fronts the entry.
- **Judges review at zero cost** — they will NOT buy tokens, fund wallets, or create accounts. Ship hosted demo + credentials + recorded fallback.
- IP: you keep ownership; TxODDS gets perpetual royalty-free showcase license. Submissions not confidential.
- Data licensed **for the hackathon only** — no redistribution, no competing products.
- **No FIFA branding/marks** or implied affiliation.
- Comply with local gambling/financial law yourself; law of England; TxODDS liability capped at USD 500.

## 2. Architecture (what to say on stage)

Two halves (`README.md`, `faq-overview.mdx`):

1. **Data access layer** — TxODDS proprietary fixtures / StablePrice odds / granular scores served off-chain (REST + SSE), access gated by an on-chain `subscribe` transaction. Records canonicalised and **anchored to Solana as Merkle roots** per rolling UTC interval: 5 min for odds & scores, hourly for fixtures (fixtures grouped in 10-day PDAs).
2. **Prediction/trading layer** — score-proof-settled binary predicates (`validateStat` / `V2` / `V3` with threshold, comparison, add/subtract expressions, N-dimensional geometric strategies). Docs mention on-chain trade settlement; only validation instructions exist in this repo's IDL.

On-chain program: Anchor `txoracle` v1.5.6, Token-2022 for the TxL mint. 17 instructions, 1 account type (`PricingMatrix`), 79 error codes.

## 3. Network config (exact values)

| | Mainnet | Devnet |
|---|---|---|
| Program ID | `9ExbZjAapQww1vfcisDmrngPinHTEfpjYRWMunJgcKaA` | `6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J` |
| TxL mint (Token-2022) | `Zhw9TVKp68a1QrftncMSd6ELXKDtpVMNuMGr1jNwdeL` | `4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG` |
| USDT mint | `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB` | `ELWTKspHKCnCfCiCiqYw1EDH77k8VCP74dK9qytG2Ujh` |
| RPC | `https://api.mainnet-beta.solana.com` | `https://api.devnet.solana.com` |
| Guest auth | `https://txline.txodds.com/auth/guest/start` | `https://txline-dev.txodds.com/auth/guest/start` |
| API base | `https://txline.txodds.com/api/` | `https://txline-dev.txodds.com/api/` |
| Free World Cup tiers | level `1` (60s delay), level `12` (real-time) | level `1` only, `samplingIntervalSec = 0` (≈ real-time) |

**Rule #1 of the whole API: never mix rows.** RPC, program ID, mint, guest JWT host, and activation host must all come from one column. Devnet tx activated on the mainnet host fails with `504`.

## 4. Access flow (free tier, ~15 lines of real code)

Deps: `npm install @coral-xyz/anchor @solana/web3.js @solana/spl-token axios tweetnacl`. Node **20+** required by example scripts (SSE client dep).

1. **Guest JWT**: `POST {host}/auth/guest/start` → `{token: jwt}`.
2. **Subscribe on-chain** (no TxL needed for free tier, just SOL): `program.methods.subscribe(serviceLevelId /* u16 */, durationWeeks /* u8, multiple of 4 */)` with accounts: `user`, `pricingMatrix` (PDA seed `pricing_matrix`), `tokenMint`, `userTokenAccount` (ATA, Token-2022), `tokenTreasuryVault` (ATA of mint owned by treasury PDA), `tokenTreasuryPda` (seed `token_treasury_v2`), `tokenProgram = TOKEN_2022_PROGRAM_ID`, `associatedTokenProgram`, `systemProgram`.
3. **Activate API token**: sign the exact message `` `${txSig}:${selectedLeagues.join(",")}:${jwt}` `` — with the standard bundle (`SELECTED_LEAGUES = []`) that's literally `` `${txSig}::${jwt}` `` (**two colons**) — as a **base64 detached signature from the same wallet that sent subscribe**, then `POST {host}/api/token/activate` `{txSig, walletSignature, leagues}` with `Authorization: Bearer <jwt>` → `apiToken`.
4. **Every data call carries both headers**: `Authorization: Bearer <jwt>` **and** `X-Api-Token: <apiToken>`. On `401`, renew the JWT from the same host and keep the same apiToken; no reactivation needed.

Full copy-paste versions: `documentation/worldcup.mdx` and `documentation/quickstart.mdx` in the repo.

## 5. API surface (from the live OpenAPI spec)

| Method | Path | What |
|---|---|---|
| POST | `/auth/guest/start` | Guest JWT |
| POST | `/api/token/activate` | Activate subscription → API token |
| POST | `/api/guest/purchase/quote` | TxL purchase quote (paid tiers only) |
| GET | `/api/fixtures/snapshot` | Latest fixtures (filter by competition / start day) |
| GET | `/api/fixtures/updates/{epochDay}/{hourOfDay}` | Fixture updates for a day/hour |
| GET | `/api/fixtures/validation` | Merkle proof for one fixture update |
| GET | `/api/fixtures/batch-validation` | Merkle proof for hourly fixture batch |
| GET | `/api/odds/snapshot/{fixtureId}` | Latest odds for fixture |
| GET | `/api/odds/updates/{fixtureId}` | Live odds updates for fixture |
| GET | `/api/odds/updates/{epochDay}/{hourOfDay}/{interval}` | Historical 5-min odds bucket |
| GET | `/api/odds/stream` | **SSE** real-time odds |
| GET | `/api/odds/validation` | Merkle proof for one odds update |
| GET | `/api/scores/snapshot/{fixtureId}` | Per-action score snapshot |
| GET | `/api/scores/updates/{fixtureId}` | Score sequence, current window |
| GET | `/api/scores/updates/{epochDay}/{hourOfDay}/{interval}` | Historical 5-min score bucket |
| GET | `/api/scores/historical/{fixtureId}` | Full score replay (fixture started 6h–2wk ago) |
| GET | `/api/scores/stream` | **SSE** real-time scores |
| GET | `/api/scores/stat-validation` | Merkle proof for stats (`validateStat`/`V2` inputs) |
| GET | `/api/scores/stat-validation-v3` | Merkle multiproof (`validateStatV3`) |

SSE: `Accept: text/event-stream`; add `Accept-Encoding: gzip` for 70–80% bandwidth cut (gunzip chunks yourself). Open stream + heartbeats ≠ data — data flows only while a covered fixture is live.

## 6. World Cup fixtures you can demo with (`documentation/scores/schedule.mdx`)

All UTC, all with Scores + StablePrice odds. Global deadline Jul 19 23:59 UTC; London local pool 12:00 BST — plan around both:

- **`18257865` France vs England — 3rd place, TONIGHT Jul 18 21:00 UTC** → live during the whole build window. Record the demo video against this match.
- **`18257739` Spain vs Argentina — FINAL, Jul 19 19:00 UTC** → ends ~2h before the global 23:59 UTC close: the agent can run live on the FINAL before submission (tight — have the submission drafted first). Already past the 12:00 BST local-pool deadline though.
- Replayable via `/api/scores/historical/{id}` (6h–2wk window): semis `18237038` France–Spain (Jul 14), `18241006` England–Argentina (Jul 15); quarters `18209181` France 2-0 Morocco, `18218149` Spain 2-1 Belgium, `18213979` Norway 1-2 England, `18222446` Argentina 3-1 Switzerland; plus round-of-32/16 IDs in the schedule page.
- Demo strategy: build on **historical replay** (deterministic, always available), overlay live stream tonight for the wow moment.

## 7. Soccer feed cheat sheet (`documentation/scores/soccer-feed.mdx` + `assets/txodds-soccer-feed-v1.1.pdf`)

- **Game phases:** 1 NS · 2 H1 · 3 HT · 4 H2 · 5 Ended · 6 WaitET · 7 ET1 · 8 HTET · 9 ET2 · 10 FET · 11 WaitPens · 12 Shootout · 13 FPE · 14 Interrupted · 15 Abandoned · 16 Cancelled · 17/18 coverage cancelled/suspended · 19 Postponed.
- **Stat keys (base 1–8):** 1/2 goals P1/P2 · 3/4 yellows · 5/6 reds · 7/8 corners. **Period prefix** added to base: 0 total, 1000 H1, 2000 HT, 3000 H2, 4000 ET1, 5000 ET2, 6000 pens, 7000 ET-total. E.g. `3001` = P1 goals in H2, `6001` = P1 shootout goals.
- **Settlement marker:** the `action=game_finalised` record has `statusId=100`, `period=100` — the ONLY record that proves final outcome (an in-running record proves state at that instant only).
- Quirks: no `foul` action (use `free_kick` + `Data.FreeKickType` ∈ Safe/Attack/Danger/HighDanger/Offside); `shot.Data.Outcome` ∈ OnTarget/OffTarget/Woodwork/Blocked; `var.Data.Type` ∈ Goal/Penalty/RedCard/...; penalty ∈ Scored/Missed/Retake; hydration break = `comment` with `Data.Text="Water-drinking break"`.
- `Participant1IsHome` is a feed label, not venue truth (neutral-venue World Cup!).
- Other sports: NCAAF + NCAAB (JSON event schemas in `assets/scores/schemas/{basketball,usfootball}/`, ~50 event types each). Soccer has no JSON schema files — PDF + mdx only.

## 8. Odds: StablePrice (`documentation/odds/*`)

- **StablePrice = de-margined consensus probability** aggregated across global books (incl. sharps), outlier-filtered — a "true price", not a bookmaker line. Great for win-probability UIs, fair-value comparisons, model baselines.
- Soccer coverage: 1,370 competitions (CSV: `assets/SoccerSupportedLeagues.csv`, also at `https://txodds.github.io/tx-on-chain/assets/SoccerSupportedLeagues.csv`). World Cup itself comes via the free-tier International bundle. NCAAB comp `300043`; NCAAF `500005` (FBS), `550001` (FCS).
- Markets are **per-fixture, not guaranteed** — inspect `SuperOddsType` + market params in the payload before assuming handicap/totals exist.

## 9. On-chain proof validation (the sponsor-pleasing move)

Prove any score/odds/fixture record against the on-chain Merkle root — costs nothing as a `.view()` simulation:

1. Fetch proof: `/api/scores/stat-validation?fixtureId=&seq=&statKey=` (or `statKeys=1,2,...` for V2, `/stat-validation-v3` for V3 multiproof).
2. Derive the root PDA — seeds:
   - scores: `["daily_scores_roots", epochDay as u16 LE]`
   - odds: `["daily_batch_roots", epochDay as u16 LE]`
   - fixtures: `["ten_daily_fixtures_roots", (floor(epochDay/10)*10) as u16 LE]`
3. `epochDay = floor(proofTimestampMs / 86400000)` — **always from the proof payload timestamp** (scores: `summary.updateStats.minTimestamp`; fixtures: `snapshot.Ts`; odds: `odds.Ts`), never `Date.now()`.
4. Call `validateStat` / `validateStatV2` / `validateStatV3` / `validateFixture` / `validateOdds` as `.view()` with `ComputeBudgetProgram.setComputeUnitLimit(1_400_000)` prepended.

V2/V3 predicates express real bet logic on-chain: `TraderPredicate{threshold, GreaterThan|LessThan|EqualTo}`, `Add|Subtract` binary expressions over two stats, geometric distance strategies. Ordering trap: `statKeys` request order defines strategy indices (`index`, `indexA/B` are positions 0..N, not key values); each stat must be covered exactly once (`IncompleteStatCoverage` / `DuplicateStatCoverage` otherwise).

## 10. Runnable code in the repo (don't write from scratch)

`examples/{devnet,mainnet}/` — each with `idl/txoracle.json`, `types/txoracle.ts`, `common/config.ts` + `common/users.ts` (wallet, subscribe, activation signing, JWT renewal, API client), and scripts:

| Script | Shows |
|---|---|
| `subscription_free_tier.ts` | free subscribe + activate + odds snapshot + odds SSE |
| `subscription_scores.ts` | scores snapshots + legacy `validateStat` + scores SSE |
| `subscription_scores_1stat.ts` | `validateStatV2`, single stat |
| `subscription_scores_v2.ts` / `_v2a.ts` | two-stat, binary + geometric predicates / multi-leg (`statKeys=1,2,3001,3002`) |
| `subscription_scores_v3c.ts` | `validateStatV3` multiproof |
| `fixture_validation_view_only.ts` | fixture proof + ten-day PDA, view-only |
| `historical_scores.ts` | full replay fetch |

Run recipe (devnet): `yarn install`, then
```bash
TOKEN_MINT_ADDRESS=4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG \
ANCHOR_PROVIDER_URL="https://api.devnet.solana.com" \
ANCHOR_WALLET="./_keys/wallet.json" \
yarn ts-node examples/devnet/scripts/subscription_free_tier.ts
```

## 11. Gotcha list (each one is an hour saved)

1. **Network mixing** → activation `504`. One column of the config table, always.
2. **Activation `403`** → wrong message string (remember the two colons with empty leagues), wrong wallet, signature not base64-detached, or JWT from the other host.
3. **`seq` must be a real observed value ≥ 1** (field is `Seq` or `seq` depending on mapper). `seq=0` breaks validation.
4. **Epoch day from proof timestamp**, never wall clock; u16 little-endian in PDA seeds; proof hashes must decode to exactly 32 bytes → else `InvalidMainTreeProof`.
5. **Historical endpoint window**: fixture start between **2 weeks and 6 hours ago** — a match that just ended isn't there yet for ~6h; use `/scores/updates/{fixtureId}` for the current window.
6. Subscription weeks must be a **multiple of 4** (`InvalidWeeks`); re-subscribing while active → `ActiveSubscription`.
7. `RateLimitExceeded` (6058) exists in the program despite "no rate limits" marketing — don't hammer.
8. Settlement logic must key off `game_finalised` (statusId=100), not the last in-running record.
9. Empty SSE stream usually means no covered fixture live right now — check the schedule, not your auth.
10. TxL purchases (paid tiers only) may trigger KYC — irrelevant for free World Cup tier.

## 12. Project angles (HISTORICAL — decision made: idea-01 Social Commitment Engine on Consumer track, see `docs/ideas/idea-01.md`)

Original Trading-track analysis kept for reference:

- **Sharp Movement Detector++** (sponsor's own idea #1, de-risked): agent polls/streams StablePrice odds, flags significant shifts, logs signals, **tracks its own hit rate against `game_finalised` outcomes** — and anchors every logged signal via on-chain proof (`validateStatV2` .view()) so the track record is tamper-evident. Autonomous + deterministic + uses the oracle's unique feature.
- **Agent vs Agent Arena** (sponsor idea #2): two agents, same feed, opposite strategies, positions settled on-chain via score proofs. Highest wow, more moving parts.
- **In-Play Market Maker** (sponsor idea #3): quotes two-way prices on in-play outcomes from scores+odds SSE; inventory/skew logic is the "mathematically defensible" part.
- **Trustless settlement layer** — user predicates (e.g. "England > 1.5 goals in H2" = statKey `3002` vs threshold) settled by `validateStatV2` on the `game_finalised` proof. Fits the *Prediction Markets* track too (18k pool) — same codebase could enter both tracks (still max one prize).
- **Odds-movement analytics** — historical 5-min buckets across the knockout stage as backtest data for whichever strategy ships.
- Judge-proofing: hosted demo + pre-activated API token + recorded fallback; demo video ≤5 min is the heaviest-weighted artifact — script it around the France–England live match tonight.
