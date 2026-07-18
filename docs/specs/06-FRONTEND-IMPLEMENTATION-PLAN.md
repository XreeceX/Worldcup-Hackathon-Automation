# 06-FRONTEND-IMPLEMENTATION-PLAN

> **Track sentence (verbatim from archieve/tracks/track-02.md):** "Most fans watching the World Cup are doing it with a phone in their hand. TxLINE gives you live scores, real-time odds, and match events for all 104 games, the kind of data that until now only the big operators could access. We want to see what builders who are also fans do with it. The experiences that could exist here have not been built yet."
> **Persona (real fan):** Supavich — real fan, London hackathon builder. The group-chat promise nobody ever keeps: "if we win this one, I'll donate a tenner" — said every match, kept never. (Relatable anecdote, not a cited statistic.)
> **Wow moment:** Final whistle → keeper fires → SOL visibly moves + explorer link with Merkle proof — no human touched it.

## 1. Parallel tracks — genuinely file-independent

Foundation lands the shared types and the `ApiClient` interface first; after that, tracks A and B build against the interface (backed by C's mock) and never edit C's files, and C never edits feature files.

### Foundation (sequential, before fan-out)

| Task | Files |
|---|---|
| F1. Vite + React + TS scaffold, router, `VITE_API_URL` / `VITE_USE_MOCK` env wiring | `frontend/` scaffold, `frontend/src/App.tsx`, `frontend/src/main.tsx` |
| F2. Shared types generated from 03 (Pledge, Fixture, Condition, SSE events) + `ApiClient` interface | `frontend/src/types.ts`, `frontend/src/lib/client.ts` (interface only) |
| F3. Token stub with semantic names (real values drop in from DESIGN.md §2) | `frontend/src/styles/tokens.css` |

### Track A — create-pledge flow

| Task | Files |
|---|---|
| A1. Create panel shell over the board slot + `FixtureList` + `ReplayBadge` | `frontend/src/features/create/CreatePanel.tsx`, `FixtureList.tsx`, `ReplayBadge.tsx` |
| A2. `ConditionPicker` (exactly 3 templates, plain-English sentence) + `AmountInput` (integer-math SOL→lamports bigint; balance-read-error shows ERROR, never 0) + `BeneficiaryCard` (preset charity) | `frontend/src/features/create/ConditionPicker.tsx`, `AmountInput.tsx`, `BeneficiaryCard.tsx` |
| A3. `CreateReview`: sign → confirm → register, with the distinct error states from 04 §3 | `frontend/src/features/create/CreateReview.tsx` |

### Track B — live board + card states

| Task | Files |
|---|---|
| B1. Board layout: ticker + cards grid + feed + CTA, mobile-first at 390px | `frontend/src/features/board/Board.tsx`, `ScoreTicker.tsx` |
| B2. `PledgeCard` with ALL states from 04 §3 (pending / live-progress / condition_met / transferred+explorer / failed / loading / error) — the hero component, gets the polish time | `frontend/src/features/board/PledgeCard.tsx`, `ExplorerLink.tsx` |
| B3. `SettlementFeed` incl. disconnected/reconnecting banner + pledge detail route | `frontend/src/features/board/SettlementFeed.tsx`, `frontend/src/features/board/PledgeDetail.tsx` |

### Track C — wallet + API hooks + mock layer

| Task | Files |
|---|---|
| C1. Wallet adapter setup (Phantom, devnet) + `WalletButton` + `useWalletBalance` (bigint \| ERROR) | `frontend/src/lib/wallet.tsx`, `frontend/src/hooks/useWallet.ts` |
| C2. Real `ApiClient` impl + hooks (`useApi`, `useFixtures`, `usePledges`, `usePledge`, `useCreatePledge`, `useMatchStream`) with lamports string↔bigint at the boundary | `frontend/src/lib/api.ts`, `frontend/src/hooks/*.ts` |
| C3. `mock.ts` generated from 03: every endpoint, seeded pledges one-per-state, scripted ~60s SSE timeline, `VITE_MOCK_ERRORS` error mode | `frontend/src/lib/mock.ts` |

Cross-track contract: A and B import hooks/types only from `client.ts`/`types.ts` (Foundation) — C swaps the implementation underneath without any A/B file changing. Until C3 lands, A and B use a trivial inline fixture in their own test files only.

## 2. Execution map

```
F1 → F2 → F3 ──▶ Tracks A, B, C in parallel
C3 (mock) is the highest-value early task — it unblocks realistic A/B development and the 08 test tiers
B2 (PledgeCard) before B3 — it is the demo hero
Integration: board running the mock's scripted timeline end-to-end (the demo rehearsal, no backend needed)
Then flip VITE_USE_MOCK=0 against the deployed keeper — zero component changes expected
```

## 3. Definition of done (per task)

Rendered with mock data + committed. A component task is done when every state listed for it in 04 §3 renders in the running app (mock mode, `VITE_MOCK_ERRORS` for error states) and the commit is pushed. Track C tasks are done when their hook tests pass against `mock.ts`. Integration milestone done = the full scripted timeline plays on the board: card goes pending → live progress → condition_met → transferred with explorer link, unattended.
