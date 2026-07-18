# SPECS.md — The 8-Document Spec Architecture (filled at Phase 2, in one burst)

This is the exact structure that locked team distribution at the July 2026 event (8 specs in 20 minutes → zero day-1 collisions). At spec lock, Claude generates `docs/specs/01…08` following these skeletons — in TWO waves, matching how they were actually produced:

- **Wave 1 — WHAT (01–04, generated as one batch):** overview, backend, API, frontend
- **Wave 2 — HOW + VERIFY (05–08):** implementation plans with explicitly independent tracks, then test plans

Every spec opens with the same 3-line header:
> **Track sentence (verbatim from RUBRIC.md):** …
> **Persona (real business):** …
> **Wow moment:** …

## 01-APP-OVERVIEW.md
1. Product summary (one paragraph) + tagline (one line a judge can repeat)
2. The problem — with a NUMBERS table (the worked example: gross / fees / net — real amounts, locked)
3. Solution — the golden path as a step table (operation · amount · purpose)
4. **User journeys — WAVE 1, never deferred.** One journey per persona (primary persona first = the REAL business owner), written as a narrated walk: *context → trigger → step-by-step through the screens → emotional payoff at the wow moment*. Format per step: what the user sees · what they do · what the system shows back. These journeys are the direct input to the frontend spec (04), the design interview, and the §4 builder prompt — AND they become the demo-video narration script almost verbatim. *(July 2026 lesson: the personas/use-cases spec landed at T+37, after the frontend had been rebuilt three times without them.)*
5. **Use cases table** — primary (on the golden path) and secondary (backlog candidates): actor · trigger · steps · success condition · rubric axis it serves. Anything secondary that isn't demo-visible goes straight to BACKLOG.md.
6. System architecture (one diagram-in-text: components + arrows)
7. Key design principles (human-in-the-loop, idempotency, the core invariant)

## 02-BACKEND-SPEC.md
1. Architecture + stack (decided, not optional)
2. Module breakdown — one module = one responsibility, one file each
3. Data models (canonical types, all money as Decimal)
4. Error handling policy (no silent defaults — a failed read is never a zero)
5. Constraints from PREFLIGHT.md (tool can't-do list, rate limits)

## 03-API-SPEC.md ← THE DECOUPLING CONTRACT
1. Endpoints table (method · path · purpose)
2. Per endpoint: request schema, response schema, error codes (exact JSON shapes)
3. State machine (IDLE → PROPOSED → APPROVED → VERIFIED …)
4. **Rule: the frontend mock layer is generated FROM this file** — if front and back disagree, this file is fixed first, then both sides. This is the document that lets two sessions/people work without talking.

## 04-FRONTEND-SPEC.md
1. Stack + design tokens (reference DESIGN.md §2 — do not restate)
2. Routes/pages in golden-path priority order
3. Component list (name · purpose · states: loading/empty/error)
4. State machine mirroring 03's, and the API hook contract
5. Mock layer spec (`mock.ts` implements every 03 endpoint with seeded data)

## 05-BACKEND-IMPLEMENTATION-PLAN.md
1. Parallel tracks — genuinely independent (e.g. A: pure logic, B: external client, C: read endpoints); each track lists its files, no track touches another's files
2. Execution map: foundation tasks first, then track order
3. Definition of done per task = test green + committed

## 06-FRONTEND-IMPLEMENTATION-PLAN.md
Same shape as 05: independent tracks (e.g. A: upload/approval flow, B: panels, C: feedback states), execution map, done = rendered with mock data + committed.

## 07-BACKEND-TEST-PLAN.md
Three tiers: 1) unit (pure logic, no credentials), 2) API (mocked externals), 3) **live integration (real tenant — runs day 1 and at every checkpoint, not only at the end)**. Name the invariant test explicitly.

## 08-FRONTEND-TEST-PLAN.md
Tiers: unit/component (mock layer), integration (against 03 contract), E2E on the deployed URL. Note which are wired during the event vs deferred.

## Generation rules
- One-hour box, one burst, after the T+5 gate. Overrun → cut detail, never the invariant or the wow moment.
- Specs 01–08 are the ONLY specs. New capability ideas post-lock → `BACKLOG.md` (Law 3) — at the last event specs 09–12 arrived the same night and ate day-2 runway.
- Every later work request references a spec section ("implement 03 §/approve"), never vibes.
- The masterplan (adversarial-critique consensus) is the INPUT to this burst — its kill list marks what these specs must NOT contain.
