# PROMPTS.md — The Prompt Skeletons That Drive Each Phase

**How these are used (the P0.5 pattern, applied to everything):** these skeletons are for CLAUDE, not for the human. The human hand-writes exactly ONE prompt all weekend — P0 at kickoff. From then on, at every phase boundary Claude:

1. **Compiles** the next prompt from its skeleton + the live repo state (RUBRIC.md, PREFLIGHT.md, specs, TODO.md) — every `<...>` blank filled, nothing left for the human to look up;
2. **Hands it over with delivery instructions:** which session/tab to paste it into, when, and what output to expect back;
3. **Waits for approval** (or the human just pastes it).

The human never fills a blank. If Claude ever says "copy P4 and fill in the track" — that's a process violation; the correct behavior is "here is your lane-A prompt, ready to paste into a new terminal tab named A-backend."

**Orchestration routing (when a prompt should be a /dispatch):** fan-out work runs via `/dispatch` (skill loadouts + model routing + parallel waves): the P0.5 research sweep, the P1 spikes, the P2a critique fan-out — expect its one-time plan-approval gate per run. Sequential single-brain work stays plain (no dispatch overhead, no plan gate): the P2b spec burst, the P3 skeleton (parallelism is FORBIDDEN there), checkpoints, freeze, submission. Lane sessions (P4) each OPEN as a `/dispatch` run — the router matches skills and models per subtask from the live inventory; one plan-approval per lane, territory fences written into the dispatch goal so they bind every spawned worker. Rule of thumb: dispatch where you want many hands (research, spikes, critique, lanes), plain where you want one brain (spec burst, skeleton, checkpoints, submission).

## Instructor mode (the human types `start`, `retro`, or `dryrun` — this chat drives the whole thing)

The SAME contract governs all three triggers: one micro-step per message, every prompt compiled and ready-to-fire, every destination named, every artifact path-listed. `start` runs P0→P7 (the event). `retro` runs R0→R4 (below). `dryrun` runs D0.

**Retro steps (post-event, ~2h, mostly machine):**
- **R0 — Gather:** YOU paste the winner announcements + anything observed about winning pitches (photos/notes/recordings) and confirm the event's repo is the cwd. FILES: RUBRIC.md (what was promised — the diff baseline).
- **R1 — Forensics:** Claude hands you the compiled `/dispatch` forensics prompt (parallel agents: git timeline + rework map · session-transcript mining, your prompts + friction · winner analysis vs stated rubric · adversarial critic verifying every material claim). PASTE: this chat. THEN: evidence-stamped reports. FILES: `retro/` reports.
- **R2 — Diff:** Claude presents the actual-vs-playbook table (each phase/gate: planned vs happened vs cost, evidence-linked). YOU read it and flag anything that doesn't match your memory of the event.
- **R3 — Patch:** one file at a time, Claude proposes the edits each confirmed lesson demands (rule + evidence tag). YOU approve/reject each. Rules that never fired get proposed for pruning.
- **R4 — Tag:** commit `retro: <event> → vN+1`, changelog line appended to RETRO.md, push. FILES: RETRO.md changelog.

**Dry-run step (pre-event week):**
- **D0:** Claude runs P0→P2 against a fictional event (you play along for ~1h) + fires one test prompt through every model arm; reports what rotted (keys, model IDs, MCP versions) with fixes. FILES: PREFLIGHT.md (arms check results).

Claude issues each step in exactly this format:

```
STEP <n> — <name> (~<time>)
YOU:   • <action: gather X / read Y / decide Z — only things Claude cannot do>
PASTE: <ready-to-fire prompt, personalized from repo state>
WHERE: <this chat | new terminal tab named "<name>" | Lovable | portal | external LLM>
THEN:  <expected output + what to check before saying "done">
FILES: <repo path of every document this step produced or cites — e.g.
        PREFLIGHT.md (spike evidence) · docs/IDEAS-SCORED.md (full scoring table)>
```

Rules:
- **One step per message.** Wait for "done" (or the pasted result) before issuing the next. Human can ask "why" — answer in ≤2 sentences, the rationale lives in the template files.
- **No blanks, no page-switching.** Everything needed is IN the step: documents to gather are named, prompts are compiled, destinations are exact ("open a second terminal, name the tab B-frontend, paste this"). The human leaves this chat only when physically necessary (other terminal tabs, Lovable, the portal, recording, the stage).
- **Reading assignments are explicit:** when the human must read something (masterplan, a spec, the pitch script), the step says which file, which section, and what to verify ("read MASTERPLAN.md kill list — confirm nothing you love is on it").
- **Every artifact is addressable:** any summary, score, or verdict shown in a step is a condensation of a document in the repo — the FILES line names each one with its path, so the human can always open the full version instead of trusting the summary. A step that produces a document without naming its path is incomplete.
- **Session count is announced by the instructor** ("this phase needs 3 more tabs — here are their three prompts, paste in this order"), never left for the human to figure out.
- **Gate steps are marked ⛔** and the instructor states the pass/fail evidence before asking for the go/no-go decision.
- The step sequence follows PLAYBOOK.md phases (P0→P7), micro-sliced; TODO.md is updated by Claude at every step so a crashed chat can resume with `start` → instructor reads the board and continues from the current step.

## P0 — Kickoff (T+0, first message of the event)

```
New hackathon: <event name>, starts <YYYY-MM-DD HH:MM>, submission deadline <YYYY-MM-DD HH:MM>.
Read CLAUDE.md, PLAYBOOK.md, RUBRIC.md, SUBMISSION.md.
1. Record the event clock in TODO.md (start + deadline + computed phase times) — from now on, state the current T+ and phase at the start of every work block.
2. Walk me through the Hour-0 ritual (README) — check repo location, .gitignore, first push.
3. I'll paste the judging slides/track sentences — fill RUBRIC.md with me, verbatim.
4. From EVERYTHING I provide (slides, event page, platform docs, sponsor tool docs), COMPILE a
   personalized research-dispatch prompt per the P0.5 skeleton — naming each source document
   explicitly — and show it to me for approval before launching.
```

## P0.5 — Personalized research dispatch (T+0.25, Claude COMPILES this from your event docs)

Claude generates this at the event — it is never written from memory. Shape it must follow (parallel research agents, each pinned to named source docs):

```
/dispatch — research sweep for <event name>. Source documents (cite by name in every finding):
<DOC-1: judging slides photos> · <DOC-2: event platform page/PDF> · <DOC-3: sponsor tool docs>
· <DOC-4: bounty/track briefs> · <my business context: <one paragraph>>

Parallel agents:
1. RUBRIC & JUDGE SIGNALS — from DOC-1/DOC-4: weights, track sentences verbatim, judge names/roles,
   what their employers reward; write RUBRIC.md §1–3.
2. PLATFORM TOOL TRUTH — from DOC-3 + live docs: what each sponsor tool can/cannot actually do
   (write capabilities, known-broken endpoints, rate limits); seed PREFLIGHT.md rows.
3. EXISTING-PRODUCT SCAN — what has the platform already commercialised / what apps exist in
   its marketplace, so we don't build something that exists (the "how is this different from
   what X already does?" judge question, pre-answered).
4. DOMAIN-PAIN MINING — real pains from MY business context + the tracks' target users; each
   pain with a sourced statistic if findable (these become pitch hook numbers).
5. IDEA GENERATION — MULTI-MODEL: fan the same generation brief (track sentences verbatim +
   domain pains from agent 4 + tool truths from agent 2 + my business context) to ALL frontier
   arms in parallel (GPT/Gemini/DeepSeek/GLM/Perplexity/Claude — ~15–20k tokens total, ≈ free).
   Each model returns 5–8 candidates, one line each: idea · track sentence it embodies · the
   real write it performs · wow moment · **REAL ANCHOR: the nameable real-world thing this is
   grounded in — a business, person, event, community, place, dataset, or lived experience,
   whatever fits the problem. Strength: something from the builder's OWN life (their business,
   their club, their failed venture, an event they run) > a nameable real third party > a
   generic category ("SMBs in general", "students") which is the weakest**. Then DEDUPE + MERGE into one candidate list (union
   of distinct ideas, note which model(s) proposed each). NO scoring yet — scoring stays
   single-model and mechanical against RUBRIC.md.
Output: one dossier doc per agent + the merged multi-model candidate list ready for the
6-factor scoring in P1. (Diversity belongs at GENERATION — different models propose different
idea shapes; consistency belongs at SCORING and verification.)

OPTIONAL CHAT VOICES: alongside the API fan-out, Claude hands the human a SELF-CONTAINED
chat version of the generation brief (no file references — everything inlined) for pasting
into chat-only models (Grok, the Gemini app, ChatGPT app). Strictly optional — the API arms
are the baseline; chat replies pasted back before scoring starts join the dedupe, late ones
are dropped. Same option applies at the P2a critique fan-out.
```

Deliverable: candidate list + dossiers feed P1 spike 1 directly. (This formalizes the July 2026 day-0 research fan-out — rubric research at 00:46, dossier by 01:56, which produced the winning-idea shortlist. It worked; now it's a step, not an improvisation.)

## P1 — Exploration spikes (T+0.5)

```
/dispatch Phase 1. Run the five PREFLIGHT.md spikes as parallel subtasks (route mechanical
spikes to cheap arms; approve the plan gate once); record every result in PREFLIGHT.md with real call evidence:
1. Idea scoring: candidates below — score with a 6-factor weighted rubric derived from RUBRIC.md,
   PLUS a real-anchor check: a candidate grounded in a real business/person (the owner's own first)
   outranks an invented scenario at equal score — judges connect to real things. Then STOP scoring.
2. Tool spikes: prove each write we depend on (<list tools/APIs>) with one real call each; capture IDs and the can't-do list.
3. Deploy smoke: hello-world on <host>, fetched from the real frontend origin; record CORS/base-path/favicon findings.
4. Fixture invariant: core invariant is <e.g. gross − fees − refunds == net>; write the test first, then the fixture.
5. Auth: one live call proving the token + exact scopes.
Report the T+5 gate checklist when done.
```

## P2a — Adversarial critique fan-out (T+4.5, the Reece move)

Send this SAME prompt to every frontier arm (via the router/MCP fan-out, plus any chat-UI models manually), then have Claude extract consensus:

```
You are judging a hackathon plan against this rubric: <paste RUBRIC.md §1–2>.
The concept: <one-paragraph concept + golden path + persona>.
Be adversarial. Return:
1. Honest score /100 with the weakest criterion named.
2. Top 3 upgrades ranked by rubric ROI, each with an hour estimate.
3. A kill list: everything in the concept that should NOT be built in 48h.
4. The single judge question most likely to sink this pitch, with the best answer.
```

Then to Claude: `Extract the CONSENSUS across these critiques (agreements only) into MASTERPLAN.md: score, top-3 upgrades, unanimous kill list, pitch angle. Prescriptive, amounts locked — written to be executed.`

## P2b — Spec burst (T+5, after the gate passes)

```
Gate passed. Generate docs/specs/01–08 per SPECS.md skeletons, from MASTERPLAN.md, in two waves
(WHAT 01–04 as one batch, then HOW 05–06 with independent tracks, then VERIFY 07–08).
Header on every spec: track sentence verbatim · real persona <name> · wow moment <name it>.
The masterplan kill list marks what specs must NOT contain. Then: SCOPE IS FROZEN — new ideas go to BACKLOG.md.
Fill DESIGN.md §2 with me now, then commit and push everything.
```

## P3 — Walking skeleton (T+6)

```
Phase 3, single session. Build the thinnest end-to-end golden path against the REAL integration
(spec 01 §3): <upload → propose → approve → verify shape>. No mocks on the spine. No feature work.
Done = one real transaction completes and the wow moment happens once, for real. Commit at every green step.
```

## P4 — Lane openings (T+12, one prompt per new session)

Every lane opens as a `/dispatch` run: the router matches skill loadouts from the live inventory and routes models per subtask — one plan table + one approve per lane, then it runs autonomously in its tab. The territory fence and standing rules are part of the dispatch goal, so they propagate into every worker the lane spawns.

Lane A (backend): `/dispatch You are lane A of a hackathon build. GOAL: implement 05-BACKEND-IMPLEMENTATION-PLAN.md (all tracks) against the contract in 03-API-SPEC.md. HARD FENCE: all work inside src/backend/ ONLY — no worker may touch frontend or docs. Standing rules for every subtask: tests in the same commit as code; no mocked-green claims — live smoke per 07-BACKEND-TEST-PLAN.md tier 3; update the lane-A row in TODO.md + commit at every subtask completion. Match skills and models per subtask from the live inventory.`

Lane B (frontend): `/dispatch You are lane B of a hackathon build. GOAL: first build mock.ts implementing every 03-API-SPEC.md endpoint with the seeded data from spec 01 §2, then implement 06-FRONTEND-IMPLEMENTATION-PLAN.md (all tracks) against the mock. HARD FENCE: src/frontend/ ONLY. Standing rules: DESIGN.md §2 tokens + §3 register bind every worker; screen order = spec 01 §4 journey; every screen ships loading/empty/error before the next starts; update the lane-B row in TODO.md + commit each completion. Match skills and models per subtask (design/react/build skills from the live inventory).`

Lane C (QA): `/dispatch You are lane C, QA. GOAL: drive the running app end-to-end (mock mode now, real mode + deployed URL after the next checkpoint) and try to break it — malformed inputs, double submissions, empty states, viewport extremes. HARD FENCE: NO worker edits source files, ever — findings land exclusively as TODO.md issues with exact repro steps + severity. Re-test issues marked fixed. Match QA/browser-automation skills from the live inventory.`

Lane D (pitch): `/dispatch You are lane D, pitch & submission. GOAL: work PITCH.md top to bottom — hook stats from the research dossiers, the REAL-anchor persona story, demo narration from spec 01 §4, answers for all 6 judge-Q&A questions — plus deck figures, README, screenshots, video script. HARD FENCE: docs/ and deck assets ONLY, never src/. Standing rules: SUBMISSION.md gates stay green (draft pushed, links tested); push after every doc change. Match pitch/content/figure skills from the live inventory.`

## P5 — Checkpoint (T+16 / T+22 / T+28, in lane A's session)

```
Checkpoint. All lanes committed. Merge, then run the THREE-TIER ladder in order:
1) unit suite (pure logic) · 2) API suite (mocked externals) · 3) INTEGRATION: flip the
frontend to real mode (env switch, e.g. VITE_API_URL / ?mock=0), run the golden path through
the FULL chain — browser → frontend → backend → real external service → read-back — and one
real write with its ID captured. Contract mismatch = fix 03-API-SPEC.md first, then both sides.
Hygiene sweep: git status junk-free, demo artifacts regenerated (no placeholder zeros). Push. Update TODO.md.
```

## P6 — Freeze + demo day (T+30)

```
FEATURE FREEZE. Regenerate all demo data via the reset script. Full rehearsal on the DEPLOYED url,
fresh browser. Then the demo video, two tracks in parallel (target ≤ T+36):
1) MACHINE DRAFT (Claude, zero human time): scripted golden-path run on the deployed URL,
   recorded via browser automation + TTS narration from DEMO-SCRIPT.md + FFmpeg assembly →
   a complete fallback video EXISTS from this moment, whatever else happens.
2) HUMAN VOICE (recommended ship): re-record the voice track over the machine video — or at
   minimum voice the hook + real-anchor persona segment (authenticity is the pitch; a synthetic
   voice telling YOUR story undercuts it). Rough beats unrecorded.
Commit screenshots. Time me through the PITCH.md script twice, out loud.
```

## P7 — Submission runway (T+42)

```
CODE FREEZE. Submission only. After EVERY doc edit: commit AND push.
Run the SUBMISSION.md final verification ritual with me (incognito link checks, pushed HEAD == claims).
We submit by <deadline − 2h>, not at the deadline.
```
