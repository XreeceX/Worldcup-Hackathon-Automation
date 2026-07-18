# 04-FRONTEND-SPEC — Fan-facing app

> **Track sentence (verbatim from archieve/tracks/track-02.md):** "Most fans watching the World Cup are doing it with a phone in their hand. TxLINE gives you live scores, real-time odds, and match events for all 104 games, the kind of data that until now only the big operators could access. We want to see what builders who are also fans do with it. The experiences that could exist here have not been built yet."
> **Persona (real fan):** Supavich — real fan, London hackathon builder. The group-chat promise nobody ever keeps: "if we win this one, I'll donate a tenner" — said every match, kept never. (Relatable anecdote, not a cited statistic.)
> **Wow moment:** Final whistle → keeper fires → SOL visibly moves + explorer link with Merkle proof — no human touched it.

## 1. Stack + design tokens

- **Stack (decided):** Vite + React + TypeScript, `@solana/wallet-adapter` (Phantom, devnet), deployable as a static build. API base URL via `VITE_API_URL`.
- **Design tokens:** reference DESIGN.md §2 — do not restate here. Until DESIGN.md lands, build with semantic token names (`--color-state-pending` etc.) so the token file drops in without component edits.
- Mobile-first: the track sentence is literally "phone in their hand" — the board and create flow must work one-handed at 390px width. Judged criterion #1 is Fan Accessibility & UX.

## 2. Routes/pages (golden-path priority order)

| Priority | Route | Page | Purpose |
|---|---|---|---|
| 1 | `/` | **Board** | The whole product on one screen: wallet button, live score ticker, pledge cards grid, settlement feed, "Make a pledge" CTA. In-play SSE updates land here — this is the demo. |
| 2 | `/` (modal/panel) | **Create flow** | Fixture → 1-of-3 template → amount + preset beneficiary → sign. A layered panel over the board, not a separate route — the user never loses sight of the board. |
| 3 | `/pledge/:id` | **Pledge detail** | One card, full history: create tx link, state timeline, release tx link. Lowest priority; the board card covers 90% of it. |

One board + one settlement feed only. No discovery/browse/profile surfaces.

## 3. Component list

| Component | Purpose | States |
|---|---|---|
| `WalletButton` | Connect/disconnect Phantom (devnet) | disconnected · connecting · connected · error (wrong network → prompt devnet) |
| `FixtureList` | Fixtures from `GET /api/fixtures`; replay fixture badged | loading (skeleton) · empty ("no fixtures") · error (retry) · loaded |
| `ReplayBadge` | Marks `source: "replay"` fixtures/events honestly | static |
| `ConditionPicker` | Exactly 3 template buttons; `team_wins` → home/away toggle; `total_goals_gte` → integer stepper (n ≥ 1); renders plain-English sentence | idle · selected · invalid-params |
| `AmountInput` | SOL text input → lamports `bigint` (string → `BigInt(sol * 1e9)` done in integer math, never float); shows lamports readout | empty · valid · invalid (≤0, too many decimals, exceeds balance) · balance-read-error (**shows ERROR, never 0**) |
| `BeneficiaryCard` | Preset charity wallet (name + truncated pubkey); not editable in golden path | static |
| `CreateReview` | Summary sentence + "Sign & lock pledge"; builds tx via escrow params from backend, sends, then `POST /api/pledges` | idle · signing · confirming · registered · error (rejected sig / tx failed / register failed — each distinct message) |
| `PledgeCard` | The hero component. Fixture, condition sentence, amount, beneficiary, live score + condition progress, state chip, tx links | `pending` · `pending`+live-progress · `condition_met` ("validating Merkle proof / releasing…") · `transferred` (+ explorer link, celebratory) · `failed` (reason shown) · loading · error |
| `ScoreTicker` | Live score + minute per tracked fixture from SSE | waiting · live · finalised |
| `SettlementFeed` | Single reverse-chron feed of `match_event` + `pledge_update` items; release entries link to explorer | empty ("settlements appear here at the final whistle") · streaming · disconnected (reconnecting banner) |
| `ExplorerLink` | `https://explorer.solana.com/tx/<sig>?cluster=devnet` | static |

## 4. State machine + API hook contract

The frontend mirrors 03 §3 exactly: `pending → condition_met → transferred`, `failed` from `pending`/`condition_met` with `failureReason`. The frontend never invents transitions — state is always whatever the last `pledge_update`/fetch said. Derived display-only value `liveProgress` (e.g. "condition currently true — 2 goals of 3") is computed client-side from SSE scores and is visually distinct from the state chip (progress can flip all match; state cannot).

Hooks (track C in 06 owns these):

```ts
useApi()                    // typed fetch wrapper over 03; lamports string<->bigint at the boundary
useFixtures()               // GET /api/fixtures + loading/error
usePledges()                // GET /api/pledges + totals; refetch on SSE reconnect
usePledge(id)               // GET /api/pledges/:id
useCreatePledge()           // escrow params -> wallet signAndSend -> POST /api/pledges
useMatchStream()            // EventSource on /api/stream; dispatches score/match_event/pledge_update/game_finalised
useWalletBalance()          // lamports bigint | ERROR — a failed read renders an error chip, never 0
```

All hooks are the ONLY code that talks to the network; components consume hook state. This is what makes the mock swap invisible.

## 5. Mock layer spec (`src/lib/mock.ts`)

Generated from 03 — implements **every** endpoint and SSE event with seeded data, switched by `VITE_USE_MOCK=1`:

- Seeded fixtures: 1 replay fixture (Argentina v France, `source: "replay"`) + 1 upcoming live fixture.
- Seeded pledges: one per state — `pending`, `condition_met`, `transferred` (with fake but well-formed tx signatures), `failed(condition_not_met)` — so every `PledgeCard` state renders on day 1 without a backend.
- Scripted SSE timeline (compressed to ~60s): kickoff → goal (34') → score update → goal (67') → `game_finalised` → `pledge_update` chain `pending → condition_met → transferred`.
- Mock honors the error shapes too: a flag `VITE_MOCK_ERRORS=1` makes `usePledges` totals return `balance_read_failed` and `useWalletBalance` return ERROR, to build the error states honestly.
- Mock and real client share one TypeScript interface (`ApiClient`) so the swap is a one-line provider change.

## Out of scope (killed)

No group/DAO UI, no custom condition composer (3 fixed templates only), no USDC/token selector, no odds or implied-probability display, no social discovery surfaces, no Draft/Open/Locked/Void/claim/refund states or buttons.
