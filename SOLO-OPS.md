# SOLO-OPS.md — Running the Whole Event Alone with Parallel Claude Sessions

How one person replicates the 5-person pipeline using N parallel Claude Code sessions. Derived from what actually parallelized cleanly at the July 2026 event (spec-decoupled frontend/backend: zero day-1 collisions) and what didn't (parallel work on shared files: v1→v5 rebuild churn, workers dying mid-edit, "which session was doing X?" hunts).

## The core insight

**The spec is the teammate.** Two sessions never talk to each other — they both talk to the spec. If `03-API-SPEC.md` defines every endpoint's request/response and the frontend runs on a mock layer that implements that spec, the two lanes cannot block each other. That is exactly how the 5-person team avoided collisions, and it works identically for one person running two terminals.

## Session count by phase (the honest answer to "can I run 4?")

| Phase | Sessions | Why |
|---|---|---|
| 0 — Setup | **1** | Sequential by nature |
| 1 — Exploration | **3–4** | Spikes are independent and read-only — the safest parallelism of the whole event (idea scoring · tool spikes · deploy smoke · auth) |
| 2 — Spec lock | **1** | One brain writes the contract. Splitting spec-writing creates two contracts |
| 3 — Walking skeleton | **1** | The spine is end-to-end by definition — cannot be split, and everything depends on it |
| 4 — Thickening | **2 code + up to 2 non-code** | See lane definitions below. This is the only phase where 4 makes sense |
| 5 — Freeze + demo | **2** | One rehearses/records, one fixes only what rehearsal exposes |
| 6 — Submission | **1** | Push-after-every-edit discipline needs one pair of hands |

**Rule of thumb: 2 code lanes is a proven win; a 3rd and 4th lane are safe ONLY if they don't edit code.** Four code sessions = you become a merge conflict. Never.

## The four lanes (Phase 4)

| Lane | Owns (directories) | Contract it builds against | Never touches |
|---|---|---|---|
| **A — Backend** | `src/backend/` | API spec + PREFLIGHT capability table; mocked platform client + the day-1 live smoke | frontend, docs |
| **B — Frontend** | `src/frontend/` | API spec via a **mock layer** (build `mock.ts` from the spec FIRST — the frontend then never waits for the backend) | backend, docs |
| **C — Verify/QA** | `TODO.md` issues only | The deployed/running app — drives real flows, files findings as TODO entries with repro steps | **any source file** (a QA lane that edits code collides with A/B) |
| **D — Pitch/Content** | `docs/`, deck, README, screenshots, video script | `PITCH.md` + `SUBMISSION.md` gates | `src/` entirely |

Lane D is the secret weapon for solo runs: at the last event the pitch layer (deck, video, submission copy) was crushed into the final hour because it always lost the attention fight against code. A dedicated session that ONLY does content means the submission package matures all day with zero collision risk.

## Isolation mechanics (pick the lightest that works)

1. **Directory ownership (default).** All sessions in one checkout; each lane's session prompt states its owned directories and its "never touches" list. Cheap, and sufficient when lanes are disjoint (they are, above).
2. **Git worktrees (only if lanes must touch the same files).** One worktree per lane, integrator merges. Costs merge overhead — don't pay it unless you must.
3. **Never two sessions in one directory.** This is how files get half-edited twice.

## The rotation protocol (one human, N sessions)

Your attention is the scarce resource — the sessions are not. Last event's failure mode: fire-and-forget parallel sessions, then 3 prompts spent hunting "which session was doing persona work?"

- **Name every terminal tab by lane** (`A-backend`, `B-frontend`, `C-qa`, `D-pitch`).
- **Rotate round-robin, ~15 min per stop.** At each stop: read the session's last output → approve/redirect in ONE message → move on. Don't linger watching it work.
- **Every session ends every work block the same way:** update its row in `TODO.md` (lane, status, last commit, next step) + commit. The board is the single source of truth — you read the board, never scroll history to find out where a lane is.
- **Lane prompts are spec-referenced:** "implement `03-API-SPEC.md §/approve`" — never "make approve work." Vibes-based asks were the root of the v1→v5 rebuild churn.
- **When you sleep, cut to ONE session** with an explicit autonomy handoff ("go with your recommendation, I return at HH:MM") — parallel unattended sessions multiply unreviewed decisions.

## Integration checkpoints (the anti-drift ritual)

Two lanes building against the same spec still drift. Every ~4h (PLAYBOOK checkpoints T+16/22/28):

1. All lanes commit + stop.
2. YOU (in lane A's session) merge, run the mocked suite, then the **live smoke** (real read + one real write), then load the real frontend against the real backend once.
3. Any contract mismatch = a spec bug: fix `03-API-SPEC.md` first, then both sides to match it. The spec stays the single source of truth.
4. Push. Update board. Resume lanes.

## Solo replacements for each team role (the full pipeline, one person)

| Team-run version (July 2026) | Solo version | Cost |
|---|---|---|
| Teammate runs multi-LLM adversarial critique → masterplan | Paste your concept into 2 external LLMs ("critique this hackathon plan against rubric X; score /100; top-3 upgrades by ROI with hour estimates; kill list") → have Claude extract the CONSENSUS into the masterplan | ~45 min, Phase 1 |
| Teammate formalizes specs (two-wave: WHAT 01–04, HOW-parallel 05–06, VERIFY 07–08) | Your Claude session, same two-wave prompt, one burst | ~30 min, Phase 2 |
| Lead writes paste-ready design prompt for non-coder teammates | Same doc — but it becomes lane B's opening prompt | 15 min |
| Copilot generates issues from specs | Spec sections become `TODO.md` lane entries directly | 10 min |
| Teammates ARE the parallel lanes | Lanes A–D above | — |

## Hard limits (learned, not theoretical)

- Skeleton phase and final integration are ALWAYS single-session — the two places parallelism corrupts.
- Commit before every rotation away from a session (network cutoffs killed mid-edit workers last time; a committed lane is recoverable, a mid-edit one is not).
- If you catch yourself asking a session "are you still running?" — the board protocol has broken down; fix the board, don't add sessions.
- 3+ code lanes = merge-conflict manufacturing. The ceiling is 2 code + 1 QA + 1 content, and only in Phase 4.
