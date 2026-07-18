# WALKTHROUGH.md — What a Run Actually Looks Like

A simulated 48h event (fictional: "FinTech Build Weekend", starts Saturday 10:00) showing what your screen looks like at each phase, and where parallelism is allowed vs forbidden. Read once before your first event; skim the morning of.

## T+0 · Sat 10:00 — ONE terminal

Paste `PROMPTS.md` **P0** (filled in). Claude replies like:

```
Event clock set in TODO.md: T+0 = Sat 10:00 · gate T+5 = Sat 15:00 ·
video ≤ T+36 = Sun 22:00 · freeze T+42 = Mon 04:00
Repo outside sync folders ✓ · .gitignore verified clean ✓ · pushed ✓
Now paste the judging slides — I'll fill RUBRIC.md verbatim.
```

From now on, EVERY session you open auto-prints the status board (SessionStart hook):

```
=== HACKATHON STATUS BOARD (TODO.md) ===
Event clock: T+14 · Phase 4 · next gate: checkpoint T+16
Golden path: REAL end-to-end ✅ | Last push: a3f92c1 (T+13.5) | Video: not recorded | Submission: draft ✅
=== Laws: push==done · real before mocked · scope frozen ===
```

That board replaces every "is it done? / is this still running?" question.

## T+0.5 · Explore — parallelism kind 1: SUBAGENT FAN-OUT (one terminal)

Paste **P1** once. Claude runs the five spikes as parallel background agents and reports as they land:

```
Spike 2 (tool viability): ✗ update-transaction endpoint broken — workaround logged in PREFLIGHT.md
Spike 3 (deploy smoke):  ✓ live page up — CORS needs the real origin added; favicon needs base path
Spike 5 (auth):          ✓ token works with scopes [a, b] — umbrella scope REJECTED, noted
```

One terminal, five workstreams. Claude manages the parallelism.

## T+4.5 · Critique — parallelism kind 2: API FAN-OUT (one prompt)

Paste **P2a**. The same adversarial prompt goes to ~6 frontier models simultaneously; ~2 min later:

```
CONSENSUS (4+/6 agree): score 71/100 · weakest criterion: API depth
Top upgrades by ROI: 1) live verification read-back (~1.5h) 2) idempotency demo (~1h) 3) audit panel (~2h)
Unanimous kill list: OCR · multi-platform UI · live-LLM-on-stage
→ MASTERPLAN.md written
```

## T+5 → T+12 · Gate → spec burst → walking skeleton — deliberately SINGLE session

- **T+5 gate:** all four checks green or you pick the simpler idea. No extensions.
- **P2b:** 8 specs per SPECS.md, one burst (~30–60 min), scope freezes, DESIGN.md §2 locked, push.
- **P3:** thinnest golden path against the REAL integration. No parallelism here on purpose — this is where parallel work corrupts (proven at the July 2026 event: rebuild churn, dead workers).

## T+12 · Thickening — parallelism kind 3: MULTI-SESSION LANES (you rotate)

Your screen becomes four terminal tabs, each opened with its lane prompt from **P4**:

```
┌─ Tab: A-backend ──┐ ┌─ Tab: B-frontend ─┐ ┌─ Tab: C-qa ───────┐ ┌─ Tab: D-pitch ────┐
│ owns src/backend  │ │ owns src/frontend │ │ drives the app,   │ │ owns docs/, deck, │
│ spec 05 track A   │ │ mock.ts from spec │ │ files TODO issues │ │ video script,     │
│ tests same commit │ │ 03, then track A  │ │ NEVER edits code  │ │ Q&A bank answers  │
└───────────────────┘ └───────────────────┘ └───────────────────┘ └───────────────────┘
     Rotation: ~15 min per tab → read output → ONE steering message → next tab
```

All four run concurrently; you are the rotation, not the bottleneck. Every ~4h paste **P5** into tab A: lanes stop → merge → live smoke (real read + one real write + real frontend against real backend) → hygiene sweep → push → resume.

## T+30 → T+48 · Contract back to 1–2 sessions

- **P6 (T+30):** feature freeze · regenerate demo data · rehearse on the DEPLOYED url · **record the video Sunday evening (≤ T+36), never the final morning** · commit screenshots.
- **P7 (T+42):** code freeze · push after every doc edit · SUBMISSION.md verification ritual (incognito link checks, pushed HEAD == submitted claims) · **submit 2h early.**

## Parallelism summary

| Kind | What runs in parallel | Phase | Who manages |
|---|---|---|---|
| Subagent fan-out | 5 exploration spikes | 1 | Claude |
| API fan-out | ~6 frontier critiques | 1→2 | Claude |
| Multi-session lanes | 4 terminal tabs (A–D) | 4 only | You (15-min rotation) |

**Forbidden zones:** spec burst, walking skeleton, final integration, submission runway — single-session by rule. Those are exactly the places parallelism caused rebuild churn and mid-edit worker deaths at the event this template was distilled from.
