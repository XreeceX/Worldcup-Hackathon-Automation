# Build Plan — Market Pulse (odds-implied probability) + Risk-Ranked Backlog

Written ~02:00 BST Jul 19. Local deadline 12:00 BST, global 23:59 UTC. The core product is DONE and pushed (`dev-log-01.md`). This doc covers the one approved remaining feature and everything else that *could* still be built, ranked by risk, so nobody burns the stable build chasing a nice-to-have.

---

## Part A — Market Pulse (approved, ~1–1.5h, low risk)

Show the market-implied probability of a condition at pledge time, sourced from TxLINE consensus odds. No program changes, no redeploy, no SOL cost, no new deps.

### Verified data facts (probed live, 2026-07-19 ~01:50)

- `GET /api/odds/snapshot/{fixtureId}` → array of market rows. Bookmaker `TXLineStablePriceDemargined` (BookmakerId 10021) carries **`Pct` fields that are already demargined probabilities** — use them directly, never compute 1/price.
- `?asOf=<ms>` works on finished fixtures → **replay-demoable**. At kickoff of `18241006`: England 35.524 / draw 33.434 / Argentina 31.046.
- Market types present: `1X2_PARTICIPANT_RESULT` (full match = `MarketPeriod: null`; H1 rows exist — ignore them), `OVERUNDER_PARTICIPANT_GOALS` (`MarketParameters: "line=2.5"` etc.), `ASIANHANDICAP_PARTICIPANT_GOALS`. **No BTTS market exists.**
- Some rows have `Pct: ["NA", …]` (seen on line=2.25) — skip non-numeric Pct rows.

### Template → market mapping

| Template | Market row | Probability |
|---|---|---|
| TeamWins (param 0/1) | `1X2_PARTICIPANT_RESULT`, `MarketPeriod == null` | `Pct[0]` home / `Pct[2]` away |
| TotalGoals ≥ N | `OVERUNDER_PARTICIPANT_GOALS`, `line == N - 0.5` | `Pct[PriceNames.indexOf("over")]` |
| BTTS | — none — | **Render nothing.** Never fabricate a joint probability (review §2.3 principle) |

### Implementation steps

1. **Keeper** (`keeper/board.mjs` or new `keeper/odds.mjs`): `GET /api/odds/:fixtureId` →
   - fetch `/odds/snapshot/{id}`; if empty/404 and the fixture has a known `startTime`, retry with `?asOf=<startTime - 5min>` (covers finished/replay fixtures);
   - filter BookmakerId 10021, drop `Pct` = "NA" rows, condense to `{ homeWinPct, drawPct, awayWinPct, over: { "0.5": pct, "1.5": pct, … }, asOf }`;
   - cache 60s per fixture. Credentials stay server-side, as with all TxLINE calls.
2. **Frontend lib** (`web/lib/api.ts`): `useOdds(fixtureId)` SWR hook + `impliedPct(odds, template, param): number | null` selector implementing the mapping table (returns `null` for BTTS or missing line → chip hidden).
3. **Wizard step 1** (`web/app/fixture/[id]/page.tsx`): on each condition option card, when a probability exists, a small chip: `Market pulse · 31% implied chance`. One shared disclosure line under the cards: *"From TxLINE consensus odds at a glance — context, not a promise. Your pledge settles on the final result only."*
4. **Commitment page** Zone B: add a `Market pulse at creation` meta cell (only if available). Persisting creation-time odds on-chain is out of scope — display current/kickoff snapshot and label it honestly (`as of kickoff` when `asOf` fallback used).
5. **Receipt flourish**: if the condition resolved YES and implied pct < 50, add one line to the ProofReceipt: `Beat the odds — the market gave this 31%.` (gold text; skip when pct ≥ 50 or unavailable).
6. **Docs**: add `/api/odds/snapshot` to the endpoints table in `README.md` + `submission-01.md` §2; add one beat to the video script (step 1 of the wizard: "and TxLINE's own consensus odds tell you what the market thinks — 31%").

### Acceptance checks

- [ ] Wizard on fixture `18241006`: TeamWins(England) chip shows ~36%, TeamWins(Argentina) ~31%, TotalGoals 3+ shows the o2.5 figure, **BTTS shows no chip**
- [ ] Keeper endpoint returns condensed JSON for a finished fixture (asOf fallback) and for an upcoming one (`18257739` final)
- [ ] Vocabulary check: no "odds/bet/stake" wording in any new UI copy — "market pulse", "implied chance"
- [ ] `next build` clean; ceremony/receipt flow unaffected (re-run one replay pass)

**Kill rule:** if not demo-clean in 90 minutes, revert the frontend chips (keeper endpoint can stay — it's additive) and ship without it. The core demo does not depend on this feature.

---

## Part B — Possible but risky: do NOT build before the local deadline without a conscious decision

Ranked by value-per-risk. "Risk" includes: program redeploy cost (~1.83 SOL close/redeploy cycle + new program ID + re-seeding demo data), destabilizing the verified demo arc, and clock burn.

| # | Item | Value | Why it's risky / cost | Verdict for deadline |
|---|---|---|---|---|
| 1 | **In-play odds on the Match Center** (proxy `/odds/stream` SSE, live probability ticking during the match) | High demo wow — "the market reacts to the goal in real time" | New SSE plumbing + replay has no odds timeline (odds stream is live-only; would need interval backfill via `/odds/updates/{day}/{hour}/{interval}` replayed in sync with score events — fiddly time alignment) | **Skip for local deadline.** Candidate for the 12:00→23:59 window if Market Pulse landed cleanly |
| 2 | **`void_fixture` instruction** (validateFixture CPI path, FR-8.2) | Completes the spec; strong "no stuck funds" story | Program change → full close/redeploy cycle (SOL we don't have), new IDL, keeper fixture-poll wiring, and no way to demo it (no cancelled fixture exists to prove it on camera). `void_timeout` already covers the fund-safety story | **Skip.** Documented as designed-not-shipped; timeout path exists and is demoable by argument |
| 3 | **500-member cap via incremental realloc** | Restores original FR-3.5 | Program change (redeploy cost) + multi-ix create flow in every client + zero demo visibility (nobody sees member 201 in a 5-min video) | **Skip.** 200 is documented and defensible |
| 4 | **Postgres indexer** (design §8 as written) | Matches design doc; production-ready optics | Whole new service + deploy for zero functional gain at demo scale; indexer-lite already serves the same API | **Skip permanently for hackathon.** Mention as production roadmap in the video |
| 5 | **Creation-time odds stored on-chain** (extend Commitment account) | "Locked at 31%" becomes verifiable, enables post-hoc "beat the odds" stats | Program account layout change → redeploy AND breaks memcmp offsets in keeper (`STATUS_OFFSET`) — touches everything | **Skip.** Display-layer only (Part A) |
| 6 | **Mobile polish pass + phone segment in video** | Track judges value mainstream-fan UX | Untested surface; responsive bugs found at 10:00 would eat recording time | **Timebox 20 min max**, after Market Pulse, screenshots only — no new CSS beyond quick fixes |
| 7 | **Backpack wallet adapter** (FR-11.1 lists three wallets; only Phantom + Solflare wired) | Spec completeness | `@solana/wallet-adapter-wallets` version pulled in doesn't obviously export Backpack; Backpack injects via Wallet Standard anyway (auto-detected without an adapter) | **Skip code change.** Note in submission that Wallet Standard covers it |
| 8 | **Live-match usage in demo** (a real fixture during recording window) | Authenticity | Deadline-morning fixtures unverified; replay decision already made and documented precisely to avoid this dependency | **Skip.** Replay-only stands |
| 9 | **Deploy to Vercel/Railway before recording** | Judges need a link anyway | Env/CORS/SSE-buffering surprises on hosted infra (SSE through some proxies needs `X-Accel-Buffering: no`); localhost recording is equally valid for the video | **Do after the video is safely recorded**, not before. Needs user logins regardless |

### Standing rules while the clock runs

1. **No `tifo/programs` edits** without explicit decision — every one costs ~1.83 SOL, a program-ID rotation, IDL resync (`web/lib/idl/tifo.json`), keeper restart, and demo re-seeding.
2. **Never run bare `cargo update`** — the edition2024 pins in `tifo/Cargo.lock` are what make the Docker build work (dev-log §2.5).
3. Record the video against the **production** web build (`next build && next start`), not the dev server.
4. Anything that breaks the replay arc (seed → lock → replay → ceremony → receipt) gets reverted first, investigated later.
