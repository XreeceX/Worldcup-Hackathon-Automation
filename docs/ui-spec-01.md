# UI Specification — TIFO (Social Commitment Engine)

> A tifo is the giant choreographed display a fan community raises together before kickoff — thousands of individual cards forming one image. That is this product: individual pledges composing into one collective, visible act. **TIFO** is the working product name; every reference below uses it. (Renaming later is a find-and-replace — nothing structural depends on it.)

This document specifies what the frontend should look like, feel like, and how to build it. It is deliberately ambitious: the demo video is the primary judged artifact, and the judges of Track 1 explicitly reward a "Verifiable Resolution UI" and a compelling fan-facing use case. The goal of this UI is not to decorate an escrow — it is to make **cryptographic settlement feel like a stadium moment**.

The design must serve three audiences at once:
1. **The judge watching a 5-minute video** — every screen must read instantly at 1080p compression; the settlement moment must be an unmistakable climax.
2. **A fan with a phone** — one-thumb create flow, zero jargon until they ask for it.
3. **A skeptic** — every claim of trustlessness backed by a visible, clickable proof.

---

## 1. Product identity

| Element | Spec |
|---|---|
| Name | **TIFO** |
| Tagline | *"Put it on the line."* |
| Sub-line (hero, board header) | *"Conditional pledges, settled by the final whistle. No bookmaker. No committee. Just proof."* |
| Voice | Confident, terse, sporting. Second person. Never gambling vocabulary — **banned words:** bet, odds, wager, payout, stake, house, win money. **Vocabulary:** pledge, vow, commitment, rally, release, refund, proof, whistle. |
| Logo treatment | Wordmark "TIFO" in the display face, with the "O" drawn as a centre-circle ring (a stroked circle). Pure CSS/SVG — no asset pipeline. |

**Product-fiction rule:** No FIFA marks, no "World Cup™" branding, no national federation crests (T&C prohibition). Teams are represented by name + two-letter code + flag emoji + team colour. This constraint is a gift: it forces a typographic identity that looks more original than badge-scraping.

---

## 2. Design language

### 2.1 Theme: "Night match"

One theme only — dark. A floodlit-stadium palette: near-black pitch, white light, one electric accent. Do not build a light mode; it doubles QA surface and the dark frame reads dramatically better on video.

### 2.2 Color system (CSS custom properties)

```css
:root {
  /* Surfaces */
  --pitch-950: #07090C;   /* app background — near-black, blue-cold */
  --pitch-900: #0C1014;   /* page sections */
  --pitch-800: #12181F;   /* cards */
  --pitch-700: #1A222B;   /* raised cards, popovers */
  --line-600:  #26303B;   /* borders, dividers (the "pitch lines") */

  /* Text */
  --chalk-100: #F2F5F7;   /* primary text — floodlight white */
  --chalk-400: #96A3B0;   /* secondary text */
  --chalk-600: #5C6975;   /* tertiary, timestamps */

  /* The accent — "under the lights" green. Used ONLY for live/active signals. */
  --turf-400:  #34E27A;
  --turf-500:  #17C964;   /* primary buttons, live pulses, met-condition */
  --turf-glow: rgba(23, 201, 100, 0.35);

  /* Settlement gold — used ONLY for executed/released money moments. */
  --gold-400:  #F5C044;
  --gold-glow: rgba(245, 192, 68, 0.30);

  /* States */
  --void-400:  #8B93FF;   /* void / neutral outcomes */
  --loss-400:  #FF6B6B;   /* refund path, destructive, errors */
  --info-400:  #4DA3FF;   /* links, explorer references */
}
```

Discipline rules that make the demo look designed rather than themed:
- **Green means live.** Nothing decorative is green. If green pulses, something is happening on the pitch or on-chain right now.
- **Gold means money moved.** Gold appears exactly once per lifecycle — at execution. This scarcity is what makes the settlement ceremony land.
- Surfaces get *lighter* as they get closer to the user (950 → 700). No shadows heavier than `0 8px 30px rgb(0 0 0 / 0.35)`.

### 2.3 Typography

| Role | Face | Notes |
|---|---|---|
| Display / numerals-as-drama | **Archivo** (weights 500–900, use the tightest: `font-stretch` expanded for headers, condensed for tickers) | Scoreboard energy. All caps for labels, `letter-spacing: 0.08em`. |
| Body / UI | **Inter** | 15px base, 1.5 line height. |
| Data (amounts, hashes, seq, timestamps) | **JetBrains Mono** | `font-variant-numeric: tabular-nums` everywhere a number can change live — prevents layout shudder when scores tick. |

Both are Google Fonts with `next/font` self-hosting — zero external requests at runtime.

Scale (rem): 0.75 / 0.875 / 1 / 1.125 / 1.5 / 2 / 3 / 4.5 / 7. The 7rem step exists for exactly two things: the live scoreboard and the settlement amount.

### 2.4 Motion principles

Library: **Framer Motion**. Global rules:
- Durations: micro-interactions 150ms, card/panel entries 300ms, ceremonies 600–900ms. Easing `[0.16, 1, 0.3, 1]` (expo-out) for entries; springs (`stiffness 300, damping 26`) for anything that responds to a live event.
- **Live data never teleports.** A score change, member join, or total increase animates: number rolls (odometer-style digit slide), card flash (`box-shadow` pulse in `--turf-glow`, 800ms decay).
- Page transitions: none (keep it instant); section content uses staggered fade-up (30ms stagger, 12px rise).
- `prefers-reduced-motion`: all ceremonies collapse to a 200ms crossfade. Non-negotiable.

### 2.5 Texture

One signature background element: a faint **pitch-line grid** — 1px lines in `--line-600` at 8% opacity, 48px cells, plus a large radial gradient "floodlight" glow (white at 3% opacity) top-centre of every page. CSS only. It reads as "stadium at night" without a single image asset.

---

## 3. App shell

```
┌──────────────────────────────────────────────────────────────────────┐
│ HEADER (sticky, 64px, --pitch-900, border-bottom --line-600)         │
│  TIFO◯   The Board   Matches                    [◉ 2 claims] [Wallet]│
├──────────────────────────────────────────────────────────────────────┤
│ LIVE TICKER (32px strip, only when ≥1 fixture live or demo mode)     │
│  ● LIVE  FRA 1–0 ENG 34'   ·   +0.5 SOL joined Les Bleus DAO   ·  … │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│                         page content (max-w 1200px)                  │
│                                                                      │
├──────────────────────────────────────────────────────────────────────┤
│ FOOTER: program ID (mono, copyable) · "Settled by TxLINE proofs on   │
│ Solana devnet" · GitHub link                                         │
└──────────────────────────────────────────────────────────────────────┘
```

- **Header.** Wordmark links home. Two nav items only. `ClaimsBadge`: a pill that appears only when the connected wallet has unclaimed refunds — `--loss-400` dot + count, links to `/claims`, subtle 2s-interval pulse. Wallet button is the standard `WalletMultiButton` restyled to the design tokens (ghost button, mono-truncated address `7xKX…9fQ2` when connected).
- **Live ticker.** A horizontally auto-scrolling strip (CSS marquee via `translateX` keyframes, pausable on hover) fed by the keeper `/api/feed` + score proxy. Items: live scores, joins, settlements. This is the "the product is alive" signal that runs through every frame of the demo video. In demo mode it's seeded so it is never empty on camera.
- **Toasts** bottom-right, 4s, one at a time, for tx lifecycle: "Signing…" → "Confirming…" → "On-chain ✓ [view tx]".

---

## 4. Pages

### 4.1 `/` — The Board

The home page IS the public board (FR-9). No marketing splash — the product is the pitch.

**Layout, top to bottom:**

1. **Hero strip (not a hero section — 120px).** Left: tagline pair ("Put it on the line." / sub-line). Right: three live stat tiles in mono — `TOTAL PLEDGED ◆ 214.6 SOL` · `COMMITMENTS ◆ 47` · `RELEASED TO CAUSES ◆ 96.2 SOL`. Numbers roll on change. These aggregates come from the indexer; they are the first proof the protocol is alive.
2. **Filter bar.** Segmented control `All · Live · Upcoming · Settled` + fixture select + sort select (`Biggest pledge · Most members · Newest`). URL-synced (`?status=live&sort=lamports`) so demo can deep-link.
3. **Commitment grid.** Responsive card grid: 3 cols ≥1024px, 2 cols ≥640px, 1 col below. Cards are the `CommitmentCard` (Section 5.1).
4. **Feed rail.** On ≥1280px, a right-hand 320px column: the **Settlement Feed** — reverse-chron event stream (created / joined / executed / refunded / voided), each row with relative time, amount, and explorer link on settled rows. Below 1280px it collapses into a "Recent activity" section under the grid.

**Empty state** (first boot): a single oversized ghost card: "No pledges yet. The board is waiting. **[Make the first vow]**". Never ship a blank grid to the video — demo seeds prevent this, but the state must exist.

### 4.2 `/matches` and `/fixture/[id]` — Match hub

`/matches`: fixture list grouped `Live now · Today · Upcoming · Finished`, each row: flag-emoji pair, team names, kickoff in local time (`Sat 21:00 · in 3h 12m`), live score if in play (mono, green pulse dot), count of commitments on that fixture. Row click → fixture page.

`/fixture/[id]`:
1. **FixtureHeader** — the big typographic scoreboard: `FRA  1 – 0  ENG` in Archivo 900 at 3–4.5rem, phase chip (`34' · H1` live-green, or `KICKOFF IN 02:14:09` counting down live, or `FULL TIME`), venue-free (no licensed data), date line.
2. **"Raise a pledge on this match"** primary button → create wizard (Section 4.3), disabled with reason after kickoff ("Kickoff has passed — pledges are locked").
3. Commitment grid filtered to this fixture, live-updating.

### 4.3 Create wizard — `/fixture/[id]/pledge`

A full-page focused flow (not a modal) — modals demo badly. Progress rail on the left (desktop) / top (mobile): `1 Condition → 2 Cause → 3 Lock it in`. One decision per screen. Every screen keeps a persistent **match context header** (small scoreboard) so the user never loses the plot.

**Step 1 — Choose your condition.** Two oversized option cards (min-height 180px):
- `⚽⚽ BOTH TEAMS SCORE` — "Each side finds the net at least once."
- `🏆 TEAM WINS` — with an inline home/away segmented toggle rendered as two team chips in team colours. Beneath, the mandated disclosure in `--chalk-400`: *"Wins on goals — extra time counts. A draw settled by penalty shootout does not satisfy this condition."*
Selection = card border animates to `--turf-500` + glow. Below the cards, a live **plain-language restatement** builds as they choose: "You're pledging that **France beats England**."

**Step 2 — Choose the cause and the amount.**
- Beneficiary address input (mono). Under it, the warning panel (amber left-border): *"This address is unverified and cannot be changed after you sign. Funds sent here are permanent."* On valid base58, show the truncated address + a devnet explorer link ("verify this address yourself ↗") — turning the warning into an act of user verification.
- Amount: large mono input with SOL suffix + quick chips `0.1 · 0.5 · 1 · 5`. Min 0.01 enforced inline. Wallet balance shown.
- Name (optional): placeholder auto-suggests `"France DAO"` / `"BTTS pledge"`. 64-byte counter.
- **Solo/DAO is not a fork in the flow** — a single toggle: `Open this pledge for others to join` (default on). The protocol treats them identically; the UI should too.

**Step 3 — Lock it in.** The review screen is styled as a **pledge card** — a physical-ticket-like panel (the same artifact that will appear on the board): condition, match, beneficiary (full, mono), amount, name, and a footer line: *"Settles automatically by TxLINE Merkle proof. No one — including us — can redirect these funds."* One button: **`Sign & lock`**. On confirm: the card plays a 600ms "stamp" animation (scale 1.04 → 1, gold border flash), then routes to `/commitment/[pubkey]` with a one-time "Your vow is on the board" toast + explorer link.

### 4.4 `/commitment/[pubkey]` — Commitment page (the heart of the product)

Three vertical zones. This page must carry the middle three minutes of the demo video on its own.

**Zone A — The Match Center (in-play card, FR-15).** A full-width panel, `--pitch-800`, that changes personality with match phase:

- *Pre-kickoff:* big countdown (`KICKOFF IN 01:22:41`, mono, ticking), members + total prominently, join CTA dominant. At T-0 the panel plays the **lock moment**: countdown digits flip to `LOCKED 🔒`, the panel border briefly flashes white, join/withdraw controls slide away. (Client clock drives the visual; chain clock remains the enforcement — copy in a tooltip says so.)
- *Live:* the scoreboard takes over (Archivo 900, 4.5–7rem, digits roll on goal). Under it, the **ConditionStatus** banner — the single most important component in the product:
  - `TRACKING` — neutral surface, animated thin progress shimmer: "Waiting on both teams to score — France have, England haven't. (1–0, 34')"
  - `MET` — surface tints `--turf-500` at 12%, check-ring draws itself (400ms SVG stroke): "Both teams have scored ✓ — holding until the final whistle. (1–1, 67')"
  - `RESOLVED` — see ceremony below.
  The copy is generated per template + live score — always a full human sentence, never a stat code.
  Below: **EventLog** — vertical timeline of condition-relevant events (`67' ⚽ ENG — Kane`), newest slides in from the top with a green flash. Sourced from the keeper score proxy SSE.
- *Post-whistle, pre-resolve:* banner: "Full time. Awaiting on-chain settlement…" with an indeterminate progress shimmer and a live "listening for proof" log line. This gap (keeper fetching proof → tx confirming) is *deliberately shown, not hidden* — trustless settlement having a visible heartbeat is the product's thesis. If >60s, a `Resolve now` manual button fades in (FR-6.1 permissionless path).

**Zone B — The Ledger.** Two-column meta: condition (human sentence + a `view raw strategy` disclosure that pretty-prints the `validateStatV2` payload — judges will click this), beneficiary with explorer link, total pledged (rolls live), member count, kickoff time, status history (each past state with timestamp + tx link). Then the **MemberList**: rows of `address · amount · joined-when`, founder crowned `FOUNDER`, live-prepended on join with flash. Connected wallet's own row highlighted "you".

**Zone C — Actions.** One context-dependent primary action, never a button pile:
| State | Primary action shown |
|---|---|
| Open, pre-kickoff, not a member | `Join this pledge` (amount inline-input popover) |
| Open, pre-kickoff, member | `Withdraw` (ghost/destructive, confirm popover: "You'll leave this commitment entirely.") |
| Open, post-whistle | `Resolve now` (after 60s grace, as above) |
| Open, kickoff+7d | `Force void & unlock refunds` |
| Refunded/Void, member unclaimed | `Claim your X.XX SOL` |
| Executed | No action — the **Proof Receipt** stands in its place (below) |

**The Settlement Ceremony.** When the `resolved` feed event for this commitment arrives (never from score math alone — FR-15.5):

*YES path* — full-panel takeover of Zone A, ~4 seconds, skippable on click:
1. Background dims; the condition sentence appears alone, then stamps `VERIFIED ✓` (gold).
2. The amount counts up 0 → total in gold Archivo 7rem, beneficiary address beneath: `14.5 SOL → 8xKq…3Fda`.
3. A particle burst (canvas-confetti, team colours + gold, 1.5s — the only confetti in the app).
4. Settles into the persistent **Proof Receipt** card: a ticket-shaped artifact with perforated edge (CSS mask), containing: fixture, final score, condition + `VERIFIED`, amount, beneficiary, keeper→proof→CPI chain rendered as three checked steps ("Result finalised by TxLINE · Merkle proof fetched (seq 84213) · Verified on-chain via validateStatV2"), the tx signature in mono, QR of the explorer URL, and `View on Solana Explorer ↗`. **This receipt is the single frame of the demo video that answers 'why blockchain?' — treat it as the poster.**

*NO path* — no ceremony (never celebrate a loss): banner turns neutral, copy: "Final whistle — the condition wasn't met. **Your pledge comes back to you.**" + inline `Claim refund` + a small proof link ("see the proof that settled this ↗"). The refund framing must feel like the system keeping its promise, not like losing.

### 4.5 `/claims`

Header: `You have 0.62 SOL to collect` (sums across commitments, gold). List of claim cards: fixture, condition, outcome chip (`REFUNDED`/`VOID`), amount, `Claim` button each. Claimed ones drop to a collapsed "Collected" history with tx links. Empty state: "Nothing to collect — everything you've pledged is still in play or already released. ✓" The final member's claim gets a micro-note post-tx: "You closed the vault — its rent came back to you (+0.0021 SOL)." (Delightful, and it demonstrates FR-7.5 on camera.)

---

## 5. Component inventory (build-level)

### 5.1 `CommitmentCard`
```
┌───────────────────────────────┐
│ ● LIVE 34'          13 members│   ← status chip / member chip row
│ Les Bleus DAO                 │   ← name, Archivo 600, 1.125rem
│ 🇫🇷 FRA vs ENG 🇬🇧 · Sat 21:00│   ← fixture line, --chalk-400
│ "France wins"                 │   ← condition, quoted, chalk-100
│                               │
│ 14.5 SOL      → 8xKq…3Fda     │   ← amount (mono, 1.5rem) → beneficiary
│ ▓▓▓▓▓▓▓▓░░ tracking           │   ← ConditionMini strip (live only)
└───────────────────────────────┘
```
Status chips: `OPEN` (outline) · `● LIVE` (green pulse) · `EXECUTED ✓` (gold fill) · `REFUNDED` (red outline) · `VOID` (violet outline) · `CLOSED` (grey). Hover: raise to `--pitch-700`, translateY(-2px). Whole card clickable. Executed cards carry a bottom tx-link row. Skeleton variant shimmer-pulses in grid while loading.

### 5.2 Full list
| Component | Key states | Notes |
|---|---|---|
| `LiveTicker` | populated / hidden | marquee, pause on hover |
| `StatTile` | static / rolling | odometer digits |
| `FixtureHeader` | upcoming / countdown / live / FT | one component, phase prop |
| `ConditionStatus` | tracking / met / resolved-yes / resolved-no / awaiting-settlement | THE component; sentence generator per template |
| `EventLog` | empty / streaming | prepend animation |
| `ProofReceipt` | — | also rendered standalone at `/receipt/[tx]` for sharing |
| `SettlementCeremony` | yes-path only | portal overlay, skippable, reduced-motion fallback |
| `MemberList` | loading / populated / you-highlight | virtualise past 50 rows |
| `TxToast` | signing / confirming / confirmed / failed | one component drives all writes |
| `WalletGate` | wrapper | intercepts action clicks when disconnected → opens wallet modal, never hides the action |
| `AmountInput` | valid / below-min / insufficient-balance | mono, chips |
| `ClaimsBadge`, `FilterBar`, `Countdown`, `StatusChip`, `AddressLink` | — | as described above |

### 5.3 Error & edge states (from design §9.8, restyled)
- Wallet reject → toast "Transaction cancelled." (neutral, no red).
- Program error → toast maps error code to plain sentence (`KickoffPassed` → "Kickoff has passed — this pledge is locked.").
- Indexer down → amber page-top banner "Live data delayed — on-chain state is unaffected." Cards render from last cache.
- SSE drop → Match Center corner chip `reconnecting…`; ticker pauses rather than empties.

---

## 6. Real-time wiring

| Surface | Source | Transport |
|---|---|---|
| Scores, event log, phase | keeper `/api/scores/live?fixtureId=` | EventSource |
| Settlement/feed events, ceremonies | keeper `/api/feed` | EventSource |
| Board data, claims, members | indexer REST | SWR, `refreshInterval: 5000` + revalidate on feed events |
| Wallet/vault balances | RPC | on demand post-tx |

Client store: a thin Zustand slice holding live fixture states + feed backlog; components subscribe by fixtureId. All SSE handlers are idempotent on event id (SSE + poll double-delivery exists by design in the keeper).

**Demo mode (`NEXT_PUBLIC_DEMO=1`):** seeds the board with ~12 varied commitments (mix of statuses so every chip/state appears on camera), points the Match Center at the replay fixture, and accelerates the ticker. Demo mode changes *data sources only* — zero component forks. This is the single highest-leverage flag in the repo for the video.

---

## 7. Responsive & accessibility

- Breakpoints: 640 / 1024 / 1280. Mobile: ticker stays, feed rail collapses, wizard steps stack, scoreboard scales to 3rem, action buttons become a bottom sticky bar (thumb reach). The demo video should include one deliberate phone-frame segment — Track judges call out mainstream-fan usability.
- Contrast: all text pairs ≥ 4.5:1 against their surface (the token values above pass; verify `--chalk-400` on `--pitch-800` = 5.1:1).
- All live regions (`ConditionStatus`, score) get `aria-live="polite"`. Ceremony overlay is `role="status"` and dismissible by any input.
- Full keyboard path through the create wizard. Focus rings: 2px `--info-400` offset 2px — visible on dark.
- Every address everywhere is a copy-on-click + explorer link. No dead-end hashes.

---

## 8. Build plan

### 8.1 Stack
- **Next.js 14 App Router + TypeScript**, Tailwind (tokens above as Tailwind theme extension), **shadcn/ui** primitives (dialog, popover, toast, select) restyled by tokens, Framer Motion, `canvas-confetti`, SWR, Zustand, `@solana/wallet-adapter-react` (Phantom/Solflare/Backpack), `qrcode.react` for the receipt.
- No component library theming beyond shadcn — the identity comes from tokens + typography + the handful of signature components.

### 8.2 File structure
```
app/
  layout.tsx            ← shell: Header, LiveTicker, Toaster, providers
  page.tsx              ← Board
  matches/page.tsx
  fixture/[id]/page.tsx
  fixture/[id]/pledge/page.tsx   ← wizard (client)
  commitment/[pubkey]/page.tsx
  claims/page.tsx
  receipt/[tx]/page.tsx
components/  (one file per Section 5 component)
lib/
  escrow/               ← EscrowInterface + AnchorEscrow (design §9.5)
  live/                 ← SSE clients, zustand store
  conditions.ts         ← buildStrategy / conditionLabel / sentence generator
  demo.ts               ← demo-mode seed data
styles/tokens.css
```

### 8.3 Time-boxed order (fits design-doc Phase gates)
| Hours | Deliverable | Cut line |
|---|---|---|
| 0–2 | Shell, tokens, fonts, Board with mock data, CommitmentCard | — |
| 2–4 | Wizard end-to-end against AnchorEscrow; TxToast | ship with 1 template if pressed |
| 4–6 | Commitment page Zones B/C: join, withdraw, claim | — |
| 6–9 | Match Center: live score SSE, ConditionStatus sentences, EventLog | EventLog is first cut |
| 9–11 | Settlement Ceremony + Proof Receipt | **never cut — this is the demo climax** |
| 11–12 | Claims page, ClaimsBadge | badge can ship dumb (poll) |
| 12–13 | Ticker, stat tiles, feed rail | rail is second cut |
| 13–14 | Demo mode seeds, phone pass, empty/error states | — |

If catastrophically behind: the irreducible video set is **Board → Wizard → Match Center → Ceremony → Receipt**. Everything else is garnish.

---

## 9. Demo choreography hooks (consumed by `docs/submission-01.md`)

The UI is designed so the 5-minute video can be shot as one continuous arc: board alive (ticker + tiles) → create a pledge in under 40 seconds → second wallet joins on camera (member row flashes in) → countdown hits zero, panel locks → goal, digits roll, condition flips to MET → full time, "awaiting settlement" heartbeat → ceremony fires → linger two full seconds on the Proof Receipt → click through to Solana Explorer. Every one of those beats is a specified state above, reachable in replay mode with no live match required.
