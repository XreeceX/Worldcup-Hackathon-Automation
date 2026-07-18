# worldcup-hackathon2 — World Cup Hackathon (TxODDS/TxLINE)

## Process driver — hackathon-template (BINDING)

The entire hackathon process is run by `hackathon-template/` (nested repo, own remote).
Every session MUST load and follow, in this order:

1. `hackathon-template/CLAUDE.md` — operating rules (Three Laws, build/pitch/session rules)
2. `hackathon-template/PLAYBOOK.md` — phase gates and deadlines
3. `hackathon-template/RUBRIC.md` — live event facts: deadlines, judging criteria, submission requirements
4. `hackathon-template/PROMPTS.md` — instructor-mode prompt skeletons

Triggers: human types `start` → INSTRUCTOR MODE (drive whole event step-by-step per
PROMPTS.md §Instructor mode). `retro` / `dryrun` → per template CLAUDE.md.

## Override of template track lock

Template CLAUDE.md says "Track 3 — Trading" — STALE. This repo's committed decision
(commit dacb5cd) supersedes it: **Track 2 (Consumer/Fan) primary — Social Commitment
Engine (`docs/ideas/idea-01.md`), Track 1 (Settlement) secondary.** All other template
rules apply unchanged.

## Key facts

- Deadlines: London local pool **Sat 19 Jul 2026 12:00 BST**; global **19 Jul 23:59 UTC**.
- Project devnet wallet: `2ZEiuuvqSFiZY4FEjBAhTutyqhEC7ajJruHPfzq4Eq68` (keypair
  `_keys/wallet.json`, gitignored). Funded ~5.5 SOL devnet.
- TxLINE connection verified working: `export PATH="/opt/homebrew/bin:$PATH"; node scripts/connect.mjs`
  (session cache `_keys/txline-session.json`).
- Sponsor/event brief: `TXODDS-SPONSOR-BRIEF.md`. Track docs: `docs/tracks/`, idea: `docs/ideas/idea-01.md`.
- Work happens on branch `dev-supa`; PRs target `master`.
