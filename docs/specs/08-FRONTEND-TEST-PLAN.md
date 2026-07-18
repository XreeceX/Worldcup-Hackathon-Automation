# 08-FRONTEND-TEST-PLAN

> **Track sentence (verbatim from archieve/tracks/track-02.md):** "Most fans watching the World Cup are doing it with a phone in their hand. TxLINE gives you live scores, real-time odds, and match events for all 104 games, the kind of data that until now only the big operators could access. We want to see what builders who are also fans do with it. The experiences that could exist here have not been built yet."
> **Persona (real fan):** Supavich — real fan, London hackathon builder. The group-chat promise nobody ever keeps: "if we win this one, I'll donate a tenner" — said every match, kept never. (Relatable anecdote, not a cited statistic.)
> **Wow moment:** Final whistle → keeper fires → SOL visibly moves + explorer link with Merkle proof — no human touched it.

Runner: Vitest + React Testing Library (ships with the Vite scaffold). Wallet-adapter is stubbed in tests (signing is exercised manually + in the demo, not in CI).

## Tier 1 — unit/component (against the mock layer) — WIRED DURING THE EVENT

Runs on every commit. Everything renders off `mock.ts` (`VITE_USE_MOCK=1`), which seeds one pledge per state.

| Test | Asserts |
|---|---|
| `PledgeCard` state matrix | Renders correctly for `pending`, pending+live-progress, `condition_met`, `transferred` (explorer link present, href ends `?cluster=devnet`), `failed` (reason text shown), loading, error |
| `ConditionPicker` | Exactly 3 templates and no free-text input; `team_wins` needs a team; `total_goals_gte` rejects n<1/non-integer; plain-English sentence renders |
| `AmountInput` money math | "0.1" → `100000000n` via integer math; "0.000000001" → `1n`; >9 decimals rejected; no float ever passed to the client (spy assert) |
| `AmountInput` balance error | `useWalletBalance` ERROR state renders an error chip — **asserts the rendered balance is NOT "0"** |
| `SettlementFeed` | empty / streaming / disconnected-banner states |
| `FixtureList` | loading skeleton, error+retry, `ReplayBadge` shown iff `source: "replay"` |
| Scripted timeline | Mock SSE timeline drives one card `pending → condition_met → transferred` with a `pledge_update` at each step |

## Tier 2 — integration (against the 03 contract) — WIRED DURING THE EVENT

Contract tests that keep `mock.ts` and the real backend honest against the same document:

| Test | Asserts |
|---|---|
| Shape parity | Every `mock.ts` response validates against the 03 JSON shapes (states, failureReasons, lamports-as-decimal-string, error envelope `{error:{code,message}}`) |
| Hook boundary | `usePledges` exposes `bigint` lamports; totals satisfy `active + released == deposited` on mock data |
| SSE event parity | Mock emits only the five named events with 03 field sets |
| Create flow request | `useCreatePledge` produces a `POST /api/pledges` body matching 03 exactly (spied fetch) |
| Optional (if backend is up in CI): same shape assertions replayed against `VITE_API_URL` staging | Real responses parse with the identical validators — if this fails, 03 is fixed first, then both sides |

## Tier 3 — E2E on the deployed URL — MANUAL DURING THE EVENT, SCRIPTED ONLY IF TIME REMAINS

Playwright automation is DEFERRED (24h budget). Instead a manual checklist run on the real deployed URL — before the 23:00 BST skeleton deploy checkpoint, before recording the video (~05:00 BST rough take per masterplan), and before the 11:30 BST submission:

1. Open deployed URL on a phone-sized viewport (390px) — board renders, replay fixture badged "replay".
2. Connect Phantom on devnet — address appears; wrong-network prompt works on mainnet profile.
3. Create a real pledge (0.1 SOL, one of the 3 templates, preset charity beneficiary) — sign succeeds, card appears `pending`, create tx opens on explorer.
4. Watch replay in-play: score ticker and card progress visibly change on goal events (Real-Time criterion — must be on screen, not in a log).
5. `game_finalised`: card flips `condition_met` → `transferred` with NO human input; settlement feed entry appears.
6. Click explorer link — real devnet release transaction visible. **This is the wow moment; if step 5–6 fails, nothing else matters — fix before anything cosmetic.**
7. Refresh mid-match — board state restores from `GET /api/pledges`; SSE reconnects (kill wifi 10s, watch the reconnect banner).

Evidence rule: each checklist run is logged (date/time, pass/fail per step, tx signatures) in the PR/commit body — a checked box without a tx signature for steps 3–6 doesn't count.

## Wired vs deferred summary

| Tier | During the event | Deferred |
|---|---|---|
| 1 unit/component | Yes — every commit | — |
| 2 contract | Yes — every commit (staging replay optional) | CI against live backend |
| 3 E2E | Manual checklist at the 3 checkpoints | Playwright automation |
