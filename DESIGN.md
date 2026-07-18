# DESIGN.md — Frontend Rules Claude Follows

Claude reads this file before any UI work. Fill §2 at spec lock; §1 and §3 are standing rules.

## 1. Process rules (standing)

- **One design direction, locked at spec lock.** No ground-up rebuilds after lock — iterate the locked direction only. *(Evidence: frontend was rebuilt 5 times in one evening — v1→v5, one commit literally titled "last - hopefully". Elapsed cost: ~5.5 hours of the build window.)*
- **Tokens first, then components, then screens.** Define §2 once; every component consumes tokens, never hard-coded values.
- **Golden-path screens in priority order.** The screens on the demo path are finished first, completely — every one ships its loading, empty, and error states. A finished 3-screen flow beats 8 half-finished screens. *(Evidence: frontend was unfinished at submission time.)*
- **Finish means demo-ready:** real/seeded data visible, no lorem ipsum, no placeholder zeros. *(Evidence: committed P&L before/after snapshots were both all zeros — contradicting the demo's own claim on the repo judges could read.)*
- **Multi-collaborator convergence is pre-agreed:** if teammates contribute UI (Lovable exports etc.), the merge target and design direction are agreed BEFORE they start, not reconciled by rebuild afterwards.

## 2. Design direction (FILL AT SPEC LOCK — then frozen)

### 2.1 How this gets filled — the 5-minute design interview (Claude runs it at spec lock)

Humans can't describe the design they want, but they can always pick. Claude asks these as either/or choices, then renders options:

1. **Mood in 3 adjectives** — offered as pairs to pick from: calm/professional ↔ bold/energetic · minimal ↔ rich · serious ↔ playful.
2. **One reference product you trust the look of** — **default: derived from RUBRIC.md — a product native to whatever the rubric says the event is for** (SMB-user event → the owner's banking app or Xero itself; art-platform event → the tools artists love; integration/dev-platform event → the best developer dashboards, e.g. Stripe's). Judges wrote the rubric: the safest look is the one their own documents imply. "Make it feel like X's cousin" beats any adjective list.
3. **Light or dark for the demo?** (one, final — the stage projector decides winners here: light usually survives bad projectors better).
4. **One accent color** — or "derive it from the persona's world" and Claude proposes two.
5. **Density:** data-dense operator dashboard ↔ airy consumer app.

Then Claude generates **2–3 quick direction boards** (the same golden-path screen rendered in each candidate direction, as throwaway HTML) — the human points at one, may say "that one but warmer," and §2 below is filled and FROZEN. Total cost: ~5 minutes + one render cycle. This interview exists because its absence cost ~5.5 hours of rebuild churn at the July 2026 event.

| Decision | Value |
|---|---|
| Product type | _e.g. dashboard / workflow app_ |
| Persona (REAL person/business) | _name them_ |
| Tone | _e.g. calm, trustworthy, accountant-grade_ |
| Light or dark for the demo | _pick ONE; verify the deployed URL matches_ |
| Color tokens | `--bg` · `--surface` · `--text` · `--muted` · `--accent` · `--positive` · `--negative` |
| Type scale | _display / heading / body / mono-for-numbers_ |
| Spacing unit | _e.g. 4px base_ |
| Component library | _e.g. shadcn/ui — decide once_ |

## 3. Hard rules (anti-slop, demo-first)

- **The 3-second projector rule.** Every screen and every chart must communicate its one message in 3 seconds from the back of a room. If a judge must squint, it fails.
- **The wow moment gets the best design.** The named wow moment (see `PITCH.md`) is the most polished screen in the app — visible state change, satisfying confirmation (e.g. a balance flipping to £0.00 with a green check).
- **No generic AI look.** No default purple-gradient hero, no emoji-bullet feature grids, no stock illustration sets. Derive the look from the persona's world.
- **Match the event's register — derived from RUBRIC.md + the event documentation, never guessed.** At spec lock, read what the rubric and event docs say this hackathon is FOR, and design to that. Heuristics: sponsor-sells-to-end-users event (Xero→SMB owners) → minimal, professional, numbers-first · creative/art platform → bold color, expressive type, wild motion — *there* restraint is the mistake · **integration/dev-platform event → developer register: docs-grade clarity, the integration itself made visible in the UI** · healthcare → calm, clinical. Flourishes (3D, heavy animation) are banned only when they sit OUTSIDE the register — inside it, they're mandatory. *(Evidence, July 2026: rubric said "50% Xero Connection, real SMB problem" — the register was SMB accounting; our frontend carried pro animations + a 3D toggle and read "technology demo," while every recorded finalist's UI matched the register the rubric implied.)*
- **(For money/data products) Numbers are the product.** Financial figures in tabular/mono font, right-aligned, consistent decimals, explicit currency. Never let a number wrap or truncate. For non-data domains, substitute the equivalent: the artwork/content is the product — it gets the space and fidelity.
- **Trust surfaces are first-class.** Approval dialogs, audit trails, and human-in-the-loop confirmations are designed as hero features, not afterthoughts — recorded judges rewarded visible policy-bounded autonomy.
- **Demo camera path.** Design the golden-path screens for the exact order the 3-minute pitch walks through them; transitions between those screens must be instant (pre-load, no cold spinners on stage).
- **Deployed = designed.** The design is only done when it looks right on the DEPLOYED URL (correct favicon, base path, CORS-working data, both breakpoints you'll actually show). *(Evidence: favicon 404 and CORS-blocked "Real mode" were discovered on the live URL, late.)*

## 4. OPTIONAL — The external-builder prompt (Lovable / v0 / Claude design)

At spec lock, Claude compiles the locked specs + §2 into this single prompt. Paste it verbatim into Lovable (or a Claude design session) — this is how the frontend gets built by a tool or teammate without them ever reading the specs. (The July 2026 team's paste-ready design prompt was one of their proven moves; this is its reusable form.)

```
Build a <product type> web app frontend: <one-sentence product summary + tagline>.

USER & TONE
The user is <REAL persona: name, business, the pain in one sentence>. The app must feel
<3 locked adjectives from §2> — like a cousin of <reference product>. Register line for this
event: <derived from RUBRIC.md + event docs — e.g. finance: "trust and clarity beat flair" ·
art: "expressiveness and delight beat restraint" · integration/dev-platform: "make the
integration visible; docs-grade clarity beats decoration">.

USER JOURNEY (the screens exist to serve this exact walk — from spec 01 §4)
<paste the primary persona's journey: context → trigger → step-by-step (what they see /
what they do / what the system shows back) → the emotional payoff at the wow moment>
Secondary use cases the UI must not block (but not optimize for): <one line each, from spec 01 §5>.

DESIGN SYSTEM (locked — do not improvise)
- Theme: <light|dark> only. Accent: <hex>. Background/surface/text: <hex tokens from §2>.
- Type: <heading font> for headings, <body font> for body, monospace tabular figures for ALL
  money amounts (right-aligned, 2 decimals, explicit currency symbol).
- Spacing on a <N>px grid. Density: <data-dense | airy>.
- No purple-gradient hero, no emoji feature bullets, no stock illustrations, no lorem ipsum.

SCREENS (build in this exact order — finish each completely before the next)
1. <Screen 1 — e.g. Dashboard>: <purpose, key elements>
2. <Screen 2 — e.g. Upload & Propose>: <purpose, key elements>
3. <Screen 3 — e.g. Approval>: <purpose, key elements>
4. <Screen 4 — e.g. Verification/Result>: <purpose — this is the WOW screen, see below>
Every screen ships THREE states: loading, empty (helpful, not blank), and error (plain-English
message + retry). A screen without all three is not done.

THE HERO MOMENT
The most polished element in the app is: <the wow moment — e.g. "the clearing balance flipping
to £0.00 with a green verified check after approval">. Design it as a visible state change
with a satisfying confirmation. The 3-minute demo exists to show this.

DATA & API
Use this seeded demo data everywhere (never placeholder zeros): <paste the worked example
numbers from spec 01 §2 — gross/fees/net table>.
The app talks to this API (implement a mock layer for every endpoint with the seeded data,
switchable to the real backend via an env var):
<paste the endpoints table + request/response JSON shapes from 03-API-SPEC.md>
App state machine: <IDLE → UPLOADING → PROPOSED → APPROVING → VERIFIED — from 03>.

TRUST SURFACES (first-class, not afterthoughts)
- Every write action goes through an explicit approval step (drawer/dialog showing exactly
  what will be posted, in plain English, before a confirm button).
- An audit trail view: every action with timestamp and returned IDs.
- Idempotency feedback: re-submitting the same file shows "already processed — skipped".

CONSTRAINTS
- The look must match the EVENT's register, derived from its rubric and documentation:
  <fill from §2 — e.g. "minimal, professional, numbers-first" (SMB-finance event) · "bold,
  colorful, expressive motion" (creative-platform event) · "docs-grade clarity, integration
  made visible" (dev-platform/integration event)>. Flourishes outside this register are
  banned; flourishes inside it are required.
- Desktop-first at 1280px (projector), readable from 3 meters; must not break at 375px.
- Any chart must communicate its one message in 3 seconds.
- Keep the stack: <React/Vite/Tailwind or Lovable default> — no extra UI libraries beyond
  <component library from §2>.
```

**Rules for using it:** generated AFTER §2 is frozen and specs 01/03/04 exist (it quotes them — never write it from memory); one prompt, one build — iterate the result, don't re-prompt from scratch (that's the v1→v5 trap); the mock layer requirement is non-negotiable, it's what keeps the Lovable build decoupled from the backend lane.
