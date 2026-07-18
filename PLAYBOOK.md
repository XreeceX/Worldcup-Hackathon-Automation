# PLAYBOOK.md — The Phase Sequence (T+0 → T+48)

Scale proportionally for shorter events. Gates are HARD: when a gate time arrives, its overrun rule beats whatever is in progress. Claude checks the current phase before every work block.

## Phase 0 — Hour-0 Setup (T+0 → T+0.5 · 30 min cap)
- Clone template outside sync folders · `.gitignore` verified · first push · remote reachable.
- Fill `RUBRIC.md` (track sentences verbatim, weights, judges, submission requirements).
- Open the submission portal draft if it exists.
- **Exit:** clean `git status`, pushed, rubric filled. **Overrun:** you're over-engineering setup — push and move.

## Phase 1 — Front-Loaded Exploration (T+0.5 → T+5 · 4.5h box)
Run in parallel; each spike produces a written artifact in `PREFLIGHT.md`:
1. **Idea scoring (45 min):** weighted rubric scoring of candidates (the 6-factor method worked — keep it). Score → pick → STOP scoring forever. *(Last time scoring re-ran into day 2.)*
2. **Tool viability spikes (90 min):** for every external tool/API, prove the exact write you depend on with a real call; document the can't-do list.
3. **Deploy smoke (45 min):** hello-world on the real host; hit it from the real frontend origin; verify CORS, favicon, env vars.
4. **Data fixture + invariant (30 min):** write the core invariant test, then the fixture, then run it.
5. **Auth spike (30 min):** prove the token/scope path with one live call.

**The human's Phase-1 job — the mentor circuit:** the spikes run without you. Spend that time on the floor: sponsor workshops and mentors leak what the judges reward (they often ARE the judges). Ask sponsors "what do you wish existed on your platform?" and log every quote into RUBRIC.md §5 — it's free rubric intel no repo can give you, and judge warmth at Q&A time is built here, not on stage.

**⛔ GATE at T+5 (non-negotiable):** real write ✓ · live page reachable ✓ · fixture invariant ✓ · idea picked ✓. Any red → pick the simpler idea whose unknowns you DID close. Exploration buys certainty, not more options.

## Phase 2 — Spec Lock (T+5 → T+6 · 1h burst)
- Write all specs in one burst with explicit parallel-track role division. *(This produced 8 specs in 20 minutes last time — the single best sequence of the event. Keep it.)*
- Spec header: track sentence verbatim · REAL persona · named wow moment.
- **Exit:** specs pushed · SCOPE FROZEN · submission draft pushed · `DESIGN.md` §2 filled.
- **Overrun:** cut spec detail, never the invariant or the wow moment.

### The spec pipeline that locked team distribution last time (reverse-engineered — reuse it)
Five transformations, each making the previous layer more executable. Different people can own different steps:
1. **Research corpus** (lead + agent): rubric, tool capability truth, scored ideas — the Phase-1 artifacts.
2. **Adversarial masterplan** (one teammate): feed the chosen concept to 2+ EXTERNAL LLMs for critique (Grok + Perplexity worked); extract the CONSENSUS into one doc: honest score /100, top-3 upgrades ranked by rubric-ROI with hour estimates, a unanimous **kill list**, pitch angle. Write it AS A PROMPT for the build agent — amounts locked, file names fixed, explicit "agent executes parts X, humans own parts Y."
3. **Build pack** (lead + agent): consolidate ALL research + the masterplan into one canonical `BUILD.md` + a folder of small typed files (avoids context truncation).
4. **Formal numbered specs** (one teammate + their agent, ~20 min): two waves — WHAT (app overview, backend, API, frontend: 01–04 generated as one batch) then HOW-IN-PARALLEL (implementation plans with explicitly independent tracks: 05–06) then VERIFY (test plans: 07–08). Numbered specs = addressable work units ("implement spec 03 §/approve"), which is what makes distribution enforceable.
5. **Per-person bridges**: `CLAUDE.md` distilled from specs (the agent contract) · a **paste-ready design prompt** for teammates who don't use coding agents (they build in Lovable/v0 from it) · issues/kanban generated from spec docs for assignment.

## Phase 3 — Walking Skeleton (T+6 → T+12 · 6h box)
- Thinnest end-to-end slice of the golden path through the REAL integration.
- **Exit:** one real transaction completes end-to-end (the wow moment works once, for real).
- **Overrun:** stop all feature work; nothing matters until this is green.

## Phase 4 — Thickening (T+12 → T+30 · 18h)
- Features on the proven spine. Tests in the same commit. Frontend golden-path screens to FINISHED (loading/empty/error) before any new surface.
- **Checkpoints T+16 / T+22 / T+28:** live smoke (real read + one real write) · artifact-hygiene sweep (`git status` junk-free, demo data regenerated) · push · `TODO.md` updated.
- **Overrun:** drop the lowest-rubric-value feature, never a checkpoint.

## Phase 5 — Feature Freeze + Demo (T+30 → T+42 · 12h)
- Full rehearsal on the DEPLOYED url with a fresh browser.
- **RECORD THE DEMO VIDEO NOW (by T+36 at the latest).** A rough recorded demo beats a perfect unrecorded one. Re-record only if it improves. *(Last time: 1 hour left → rushed video.)*
- Regenerate all demo artifacts via the reset script. Commit screenshots. Rehearse the 3-minute pitch out loud twice against `PITCH.md`.
- **Exit:** video uploaded + linked · screenshots pushed · pitch rehearsed · deployed URL exercised end-to-end.

## Phase 6 — Frozen Submission Runway (T+42 → T+48 · code-frozen)
- No code merges. Submission copy finalized; **commit AND push after every single edit.**
- Verify every submitted link in an incognito browser.
- **Exit:** form submitted EARLY · `git status` clean · pushed HEAD == submitted claims.

## Standing rules (every phase)
- Commit before risk (parallel agents, network windows, refactors).
- Push == done.
- One golden path; ideas post-lock → `BACKLOG.md` + displacement test.
- Multi-agent only for genuinely separable work; solo on the golden-path spine.
- Human reads `TODO.md`; agent updates it at every boundary.
