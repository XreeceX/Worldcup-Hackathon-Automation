# 01-APP-OVERVIEW — Social Commitment Engine

> **Track sentence (verbatim from archieve/tracks/track-02.md):** "Most fans watching the World Cup are doing it with a phone in their hand. TxLINE gives you live scores, real-time odds, and match events for all 104 games, the kind of data that until now only the big operators could access. We want to see what builders who are also fans do with it. The experiences that could exist here have not been built yet."
> **Persona (real fan):** Supavich — real fan, London hackathon builder. The group-chat promise nobody ever keeps: "if we win this one, I'll donate a tenner" — said every match, kept never. (Relatable anecdote, not a cited statistic.)
> **Wow moment:** Final whistle → keeper fires → SOL visibly moves + explorer link with Merkle proof — no human touched it.

## 1. Product summary + tagline

Social Commitment Engine turns a fan's match-day promise into a self-executing on-chain pledge. A fan connects Phantom (devnet), picks a World Cup fixture from TxLINE, picks one of three fixed condition templates, locks devnet SOL against a preset charity beneficiary, and signs once. From then on no human touches it: the live board card updates in-play from TxLINE's SSE feed, and when TxLINE emits `game_finalised` the keeper validates the condition against TxLINE's stat-validation Merkle proof and fires the release transaction automatically. The card flips to "transferred" with a Solana explorer link. Track 2 (Consumer and Fan Experiences) only.

**Tagline:** *"When the result becomes true, the promise becomes a transaction."*

## 2. The problem — with numbers

Fans make conditional promises constantly and keep almost none of them, because there is no enforcement layer. FIFA reports 1.7 billion social engagements (TikTok + YouTube) and video views up 485% vs 2022 for this World Cup (FIFA media release, inside.fifa.com, 8 July 2026 — verified in docs/research/masterplan.md validator table). All that engagement, and none of it settles into anything real.

Worked example (real amounts, locked — all money is lamports as bigint, never float):

| Line | Amount (lamports) | Amount (SOL) | Note |
|---|---|---|---|
| Pledge locked at create | 100,000,000 | 0.100000000 | Fan signs one tx; funds move to escrow |
| Network fee (create tx) | ~5,000 | ~0.000005 | Paid by pledger, standard Solana fee |
| Network fee (release tx) | ~5,000 | ~0.000005 | Paid by keeper |
| **Beneficiary receives** | **100,000,000** | **0.100000000** | Hackathon build takes zero protocol fee |
| Future settlement fee (illustrative only, NOT in build) | 500,000 | 0.0005 | "Under 1%, comparable to Polymarket's sports taker fee" — exact rate unsourced, per masterplan validator; never state 0.75% flat |

Demo wallet holds 5.49792092 devnet SOL (verified balance, masterplan validator table).

## 3. Solution — the golden path

| # | Operation | Amount | Purpose |
|---|---|---|---|
| 1 | Connect Phantom (devnet) | — | Wallet sign-in; required by track ("sign up through Solana") |
| 2 | Pick fixture (TxLINE fixtures) | — | Selects the match the condition binds to |
| 3 | Pick 1 of exactly 3 condition templates | — | "Team X wins" / "Both teams score" / "Total goals ≥ N" |
| 4 | Set amount + beneficiary | 100,000,000 lamports (0.1 SOL) | Beneficiary is the preset charity wallet |
| 5 | Sign create tx | 100,000,000 lamports → escrow | Pledge becomes `pending`; card appears on live board |
| 6 | Watch match in-play | — | Card visibly updates from TxLINE SSE (scores, events, condition progress) |
| 7 | `game_finalised` → keeper validates | — | TxLINE stat-validation Merkle proof checked; state → `condition_met` |
| 8 | Release tx fires automatically | 100,000,000 lamports → beneficiary | State → `transferred`; card shows Solana explorer link |

## 4. User journeys

### Journey 1 — Supavich, the pledger (primary persona)

**Context:** Friday night, group chat is on fire about tomorrow's England fixture. Supavich types the usual: "if we win this I'll donate a tenner to the youth club." Everyone has typed that message before. Nobody has ever followed through — the match ends, the chat moves on, the promise evaporates.

**Trigger:** A friend replies "prove it" with a link to the app.

| Step | What Supavich sees | What they do | What the system shows back |
|---|---|---|---|
| 1 | Landing page: live board of pledge cards + "Connect Wallet" | Taps Connect, approves in Phantom (devnet) | Wallet address appears, "Make a pledge" enabled |
| 2 | Fixture list from TxLINE (replay fixture labeled "replay", live fixtures if a match is on) | Picks the England fixture | Create panel opens with the fixture's teams and kickoff |
| 3 | Exactly three template buttons: "Team X wins" / "Both teams score" / "Total goals ≥ N" | Picks "Team X wins", selects England | Condition sentence renders in plain English: "If England win…" |
| 4 | Amount field (SOL) + preset charity beneficiary card | Enters 0.1 | "0.1 SOL → Youth Football Fund (preset charity wallet)" summary |
| 5 | "Sign & lock pledge" button | Signs the create tx in Phantom | Card lands on the live board in `pending`, with the create tx link |
| 6 | Match goes live: score ticker moves, events scroll in the settlement feed | Watches | Their card updates in-play: score, minute, condition progress ("England 1–0, condition currently true") |
| 7 | Final whistle | Nothing — this is the point | Card flips `pending` → `condition_met` ("validating Merkle proof…") → `transferred`, with the release tx explorer link |

**Emotional payoff (the wow moment):** Supavich did nothing after signing. The final whistle blew, the keeper fired, 0.1 SOL visibly moved, and there is a Solana explorer link with a Merkle-proof-validated result to paste back into the group chat. The promise kept itself.

### Journey 2 — the judge / spectator (secondary persona)

**Context:** A judge opens the deployed URL during review. Matches may have ended (track note: judging happens after the deadline), so the board is running the labeled replay of a real historical fixture from captured TxLINE payloads.

| Step | What the judge sees | What they do | What the system shows back |
|---|---|---|---|
| 1 | Live board with active pledge cards, score ticker, settlement feed; replay fixture clearly badged "replay" | Watches, no wallet needed | Cards update as replayed TxLINE events stream in — goals move scores and condition progress in real time |
| 2 | A goal event lands | Nothing | The affected card's condition progress changes on screen within a second |
| 3 | `game_finalised` arrives in the replay | Nothing | Card runs the full real settlement: `condition_met` → real devnet transfer → `transferred` + explorer link in the settlement feed |
| 4 | Explorer link | Clicks it | Real Solana devnet transaction — the transfer was not mocked |

**Payoff:** the judge watches money move with no human in the loop, on a demo that cannot be faked because the final hop is a real devnet transaction.

## 5. Use cases

| # | Use case | Actor | Trigger | Steps | Success condition | Rubric axis served | Golden path? |
|---|---|---|---|---|---|---|---|
| P1 | Connect wallet | Fan | Opens app | Connect → approve in Phantom (devnet) | Address shown, create enabled | Fan Accessibility & UX ("sign up through Solana") | Primary |
| P2 | Create pledge | Fan | "Make a pledge" | Fixture → template → amount → sign | Card on board in `pending` with create tx | Fan Accessibility & UX, Completeness | Primary |
| P3 | Watch pledge in-play | Fan / spectator | Match events stream | SSE → score/event/progress render on card | Card visibly changes on each relevant event | Real-Time Responsiveness | Primary |
| P4 | Automatic settlement | Keeper (no human) | `game_finalised` from TxLINE | Validate via stat-validation Merkle proof → release tx → state updates pushed | Card shows `transferred` + explorer link, untouched by humans | Originality & Value, Completeness | Primary |
| P5 | Verify on explorer | Fan / judge | Clicks explorer link | Open Solana explorer | Real devnet tx visible | Completeness & Execution | Primary |
| S1 | Watch labeled replay demo | Judge | Opens deployed URL post-deadline | Replay streams captured real TxLINE payloads, real transfer at finalisation | Full loop demonstrable without a live match | Real-Time Responsiveness (demo-visible — stays in scope) | Secondary |
| S2 | List live fixtures during judging | Judge | A match is on | Live TxLINE fixtures appear alongside replay | Live data visibly flowing | Real-Time Responsiveness (demo-visible — stays in scope) | Secondary |
| S3 | Share a pledge card link | Fan | Wants to post in group chat | Copy link to card | Link renders the card | Fan Accessibility → **BACKLOG.md** (not demo-visible) |  Secondary |
| S4 | Multiple pledges per wallet across fixtures | Fan | Repeat use | Repeat P2 | Board shows all | Commercial path → **BACKLOG.md** unless free | Secondary |

## 6. System architecture

```
Phantom (devnet)
   │ sign create tx
   ▼
Frontend  (Vite + React + TS + @solana/wallet-adapter — static build)
   │  REST: /api/fixtures /api/pledges /api/pledges/:id /api/resolve/:id
   │  SSE:  /api/stream  (scores, match events, pledge updates)
   ▼
Backend keeper  (Node.js + Express)
   ├── TxLINE client — https://txline-dev.txodds.com
   │     auth: guest JWT → API token (scripts/connect.mjs pattern, _keys/txline-session.json)
   │     fixtures · scores/events SSE · stat-validation (Merkle proof)
   ├── Replay driver — captured real TxLINE payloads, labeled "replay"
   ├── Condition evaluator — pure logic, 3 templates
   ├── Keeper loop — game_finalised → validate proof → fire release tx
   └── Escrow interface (dual-path, frontend never knows which):
         Path A: minimal Anchor program (create_pledge, resolve; escrow PDA)
         Path B: keeper-custody escrow wallet (SystemProgram transfers)
   ▼
Solana devnet  →  explorer links (create tx, release tx)
```

## 7. Key design principles

1. **No human in the settlement loop.** After the pledger signs create, every later transition is machine-driven off TxLINE data. This is the wow moment and the originality claim — never add a manual "resolve" button to the golden path (the API's `POST /api/resolve/:id` exists as an idempotent backstop, not a UI step).
2. **Idempotency.** Resolution can be triggered by the keeper and by the API backstop; a pledge is released at most once. Replays of `game_finalised` or double `POST /api/resolve/:id` are no-ops after the first success.
3. **The core invariant (lamport conservation):** `sum(active pledge lamports) + released lamports == total deposited lamports`. Lamports are bigint end-to-end; never float. A failed balance read is an ERROR state, never zero (02 §4, tested by name in 07).
4. **Exactly four states:** `pending` → `condition_met` → `transferred`, with `failed` reachable from either (reasons: condition not met, transfer error, fixture cancelled). No other lifecycle exists.
5. **Honest demo.** Replay is labeled "replay" in the UI; the settlement transfer at the end of the replay is a real devnet transaction. Nothing on the golden path is mocked in the deployed build.
6. **One decoupling contract.** Frontend and backend meet only at 03-API-SPEC; the frontend mock layer is generated from it.

**Clock (RUBRIC.md §0):** local London submission deadline is HARD at July 19, 2026 12:00 BST — organizer recommends submitting by 11:30. Scope decisions bend to this, never the reverse.

## Out of scope (killed at masterplan, do not reopen)

DAO/group mode · custom condition composer · USDC or any token (devnet SOL only) · odds or implied-probability display · social discovery surfaces beyond the one board + one settlement feed · Draft/Open/Locked/Void/claim/refund lifecycle · Track 1 submission. New ideas → BACKLOG.md.
