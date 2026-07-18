# CLAUDE.md — Hackathon Operating Rules (worldcup-hackathon2)

These rules bind every Claude Code session in this repo for the duration of the hackathon. Each rule carries the evidence that earned it (July 2026 retro). When a rule conflicts with a mid-event idea, the rule wins unless the human explicitly overrides it in writing.

## Chosen track (locked)

**Track 2 — Consumer / Fan (primary), Track 1 — Settlement (secondary)** — World Cup Hackathon, sponsor TxODDS. Locked by repo commit `dacb5cd`; this supersedes any older Track 3 lock from the template's origin event. Project: **Social Commitment Engine** (`docs/ideas/idea-01.md`). Consumer-track extra requirement: sign up through Solana (wallet sign-in) + product must work during a match. Data source: TxLINE API (REST + SSE), free during the event. Every feature maps to the track sentence per the "build the track sentence" rule below.

**⚡ TRIGGER: when the human types `start` (or "start hackathon"), enter INSTRUCTOR MODE — see PROMPTS.md §Instructor mode. Drive the entire event from this chat, one micro-step at a time, until submission.**

**⚡ TRIGGER: when the human types `retro` (after an event), run the RETRO.md ritual — instructor-style, one step at a time: (1) ask for the winner announcements + anything observed about winning pitches; (2) fan out forensics agents over this repo's git history and the Claude session transcripts; (3) present the actual-vs-playbook diff with evidence; (4) propose the template patches one file at a time for approval; (5) commit as `retro: <event> → vN+1` and append the changelog line. When the human types `dryrun` (pre-event week), run RETRO.md's between-events checks: P0→P2 against a fictional event + one test prompt through every model arm.**

## The Three Laws (override everything else)

1. **Push == done.** Work that is not committed AND pushed does not exist — judges browse the remote, not your laptop. Commit at every green test; push at every phase boundary and after EVERY doc/screenshot edit in the submission window. *(Evidence: final submission docs + all 6 screenshots were never pushed; judges saw a version claiming half the real test count.)*
2. **Real before mocked.** One genuine end-to-end call against the real API/tenant/deploy target must succeed on day 1, before feature work. Green mocked tests prove nothing about the real integration. *(Evidence: 100% Xero-mocked until T-5h; the first live run exposed a wrong scope shape and a response-format crash that 110 green tests never touched.)*
3. **Scope freezes at spec lock.** After specs are committed, no new feature spec. New ideas go to `BACKLOG.md` with a displacement test: "what committed item does this replace?" *(Evidence: 3 feature specs opened the same evening before the core path ran end-to-end; a twice-merged branch and day-2 runway paid for it.)*

## Hour-0 rules

- Repo must live OUTSIDE iCloud/Dropbox/OneDrive sync. *(iCloud created 0-byte conflict duplicates of state files mid-event.)*
- `.gitignore` complete before first code commit. Adding an ignore pattern for already-tracked files REQUIRES `git rm -r --cached` in the same commit.
- `RUBRIC.md` filled before ideation. Track sentences copied VERBATIM.
- Submission draft created and pushed on day 1 (`SUBMISSION.md` gates).

## Build rules

- **Golden path first.** Exactly one flow is the demo. It runs end-to-end against the real integration before anything else is built. Everything off that path is backlog.
- **Tests ship in the same commit as the code they test.** Run a LIVE smoke test (real read + one real write) at every checkpoint (see `PLAYBOOK.md`), not just the mocked suite.
- **Never report "verified/success" from a default.** Any success state must be derived from a confirmed read-back, never assumed on failure. *(Evidence: `/approve` silently defaulted a failed balance read to 0 → reported `verified=True` for ~8 hours; found by audit, not by 104 green tests.)*
- **Money is Decimal, never float.** Encode the core domain invariant (e.g. `gross − fees − refunds == net`) as a test BEFORE creating any data fixture. *(Evidence: a £59.15 fixture reconciliation bug shipped; the guard test was written 15 minutes after the fix instead of before.)*
- **Security red-first.** Any user-controlled string that reaches a filesystem path or an outbound URL gets a traversal/injection test before the handler is written. *(Evidence: unsanitized `file_hash` allowed `../..` arbitrary file read for ~9.5h.)*
- **Checkpoint commit before risk.** Commit before spawning parallel agents, before any network-unreliable window, before large refactors. Label speculative work `WIP — UNVALIDATED`. *(Evidence: ~2h lost to workers dying mid-edit on venue network cutoffs.)*
- **Verify runtime behavior before claiming done.** Run the actual flow and observe it — a plausible diff plus green tests is not "working."
- **Spike unfamiliar tool capabilities before depending on them.** Every external tool gets a `PREFLIGHT.md` entry proving the exact write you need, plus its can't-do list. *(Evidence: the MCP server couldn't approve invoices, create accounts, or do transfers, and one tool was outright broken — each gap became an emergency raw-REST workaround under deadline.)*

## Pitch & submission rules (as binding as build rules)

- **Use a REAL anchor as the persona — the owner's own business, lived experience, event, or community, whatever the problem calls for.** Never invent a brand or a hypothetical user. Name the real person/thing, the pain, the numbers. *(Evidence: every recorded winner had a real niche with a face — movie distributors, a coffee roastery, a food wholesaler on 4–6% margins, a REAL boat yard. Our synthetic "MarketplaceCo" had none. The owner's actual company WAS the best story in the room and went unused.)* **Real applies to the story, persona, and statistics — demo DATA stays synthetic when platform terms require it, but derived from the real case** (numbers shaped like the real business's, labeled synthetic). Real story + compliant data is the correct pairing; fake story + compliant data was last event's mistake. This rule starts at IDEA GENERATION: every candidate carries a "real anchor" field, and anchored candidates outrank invented ones (see PROMPTS.md P0.5/P1).
- **Build the track sentence.** The chosen track's one-line definition is quoted at the top of the spec; every feature maps to it. Recorded winners were near-verbatim instantiations of their track sentences.
- **One named wow moment.** The spec names the single 10-second moment the demo exists to deliver (a live write landing, a balance hitting zero, a live connect on stage). Rehearse it; everything else supports it.
- **Demo video is recorded at feature freeze (T-12h), not in the final hour.** Re-record later only if it improves. *(Evidence: last event left 1 hour for submission — the video was rushed and the frontend unfinished.)*
- **Sponsor tools must be visible.** If the event platforms include an automation tool (Make/n8n/etc.) and you have the skill, demo at least one real flow through it — judges probed every team on exactly this, and sponsor-tool visibility scored. *(Evidence: the winning integrator's stack was sponsor tools glued together; our Make/n8n skill went unused.)*
- **Maintain `PITCH.md` from day 1** — including the judge Q&A bank. The recorded judges asked the same six questions of every team; prepared answers are free points.
- **Effort cap on invisible work.** Architecture depth and test count beyond "green and stable" was the LEAST-enforced judging axis on record. Once the suite is green and the golden path is solid, surplus hours go to the pitch layer, not more hardening.

## Session conduct

- **Compile, don't delegate prompts.** At every phase boundary, generate the next PROMPTS.md prompt yourself — skeleton + live repo state, every blank filled — and hand it to the human with delivery instructions (which tab, when, expected output). The human writes exactly one prompt all weekend (P0). Telling them to "copy PX and fill in the blanks" is a process violation.
- Update `TODO.md` at every phase boundary — the human reads the board instead of asking "is it done?" *(Evidence: repeated "is this running?" prompts and 3-prompt hunts for lost sessions.)*
- Before each work block, check the current gate in `PLAYBOOK.md`. If a gate deadline has passed, the gate's overrun instruction wins over the current task.
- On autonomy handoffs ("go with your recommendation"), record the decision + reasoning in `TODO.md` so the human can audit after sleep. Ask the human to state their real away-duration.
- All timestamps in commits and boards use absolute times (not "now", "later").

## Repo key facts

- Deadlines: London local pool **Sat 19 Jul 2026 12:00 BST**; global **19 Jul 23:59 UTC**. Full event facts: `RUBRIC.md`.
- Project devnet wallet: `2ZEiuuvqSFiZY4FEjBAhTutyqhEC7ajJruHPfzq4Eq68` (keypair `_keys/wallet.json`, gitignored). Funded ~5.5 SOL devnet.
- TxLINE connection verified working: `export PATH="/opt/homebrew/bin:$PATH"; node scripts/connect.mjs` (session cache `_keys/txline-session.json`).
- Sponsor/event brief: `TXODDS-SPONSOR-BRIEF.md`. Track docs: `docs/tracks/`, idea: `docs/ideas/idea-01.md`.
- **Verbatim track briefs live in `archieve/tracks/track-0{1,2,3}.md`** (submission requirements, judging criteria, eligibility, constraints — the source RUBRIC.md was distilled from). Binding constraint from briefs: TxLINE credit token is locked to their program — NO P2P transfers/staking of it; user funds use USDC/SOL in our own escrow. Alt idea archive: `archieve/ideas/idea-03.md` (Fan Passport).
- Work happens on branch `dev-supa`; PRs target `master`.
- `hackathon-template/` is the template's own nested repo (remote `supawichza40/hackathon-template`) — its playbook files now live at repo root; use the root copies. Run the `retro` ritual against the nested repo after the event.
