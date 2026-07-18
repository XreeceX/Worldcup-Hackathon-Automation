# RETRO.md — The Loop That Makes This Template Compound

The files in this kit are a snapshot. The actual strategy is this loop: **every event patches the template, so you never fight the same battle twice.** Run it within 48 hours of submission, while transcripts and memory are fresh.

## The post-event ritual (~2 hours, mostly Claude)

1. **Forensics (Claude, parallel agents):** mine the event's git history (timeline, rework commits, gaps), the Claude session transcripts (your prompts, re-asks, friction), and — if pitches were recorded or observable — what the winners actually did. Every claim evidence-stamped (commit hash / timestamp / quote).
2. **Actual-vs-playbook diff:** one table — each PLAYBOOK.md phase/gate vs what actually happened, with the hours each deviation cost. Adversarially verify the material claims (the critic pass) before trusting any number.
3. **Patch the template:** every confirmed lesson lands as an edit to the relevant file — a new rule in CLAUDE.md (with its evidence tag), a changed gate time in PLAYBOOK.md, a new judge question in PITCH.md, a new spike in PREFLIGHT.md. A lesson that isn't a file edit will be forgotten by the next event.
4. **Version-tag:** commit as `retro: <event name> → vN+1` with a 5-line changelog at the bottom of this file. The version number is the score that matters: v1 beat ~2/3 of the field; each retro should retire at least one losing pattern.
5. **Prune:** delete any rule that didn't earn its place this event (never fired, or fired wrongly). A template that only grows becomes advice nobody reads — every line must survive "would removing this cause a loss?"

## Between events (30 min, the week before the next one)

- **Dry run:** clone the template, type `start`, run P0 → P2 against a fictional event for one hour. This is PREFLIGHT applied to the template itself — model IDs churn, API keys expire, MCP servers break between events. Discover it in your kitchen, not at the venue.
- **Arms check:** verify each critique/generation arm answers one test prompt (the router config rots quietly).
- **Skim the changelog below** — the lessons you paid for.

## Why this is the moat

Every team at every hackathon starts from zero: no rubric method, no spec pipeline, no gates, no shot list. You start from the accumulated corrections of every event you've ever entered. The gap compounds — and it's invisible from the outside, because what judges see is just a team that ships early, pitches clean, and never seems rushed. Keep this repository private; the advantage is structural, not secret sauce, but there's no reason to hand it out.

## Changelog

- **v1 (2026-07-06)** — distilled from the Encode Hub Xero hackathon retrospective (101 commits, 32 sessions, recorded finalist pitches; ~top-20/61 finish). Founding lessons: push==done · real before mocked · scope freeze · real anchor · register-driven design · shot-list video · speaker-notes deck.
