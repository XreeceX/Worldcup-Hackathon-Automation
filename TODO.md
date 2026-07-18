# TODO.md — Status Board

Claude updates this at every phase boundary and after every autonomy-window decision. The human reads this board instead of asking "is it done?" / "is this still running?".

## Current state

| Field | Value |
|---|---|
| **Event clock** | start (instructor boot): 2026-07-18 16:47 BST · **HARD deadline: 2026-07-19 12:00 BST (submit by 11:30)** · ~18h45m runway |
| **Phase (see PLAYBOOK.md, compressed to 19h)** | 1 — close exploration gaps (until 18:30 BST) |
| **Current gate & deadline** | ⛔ Phase-1 gate @ 18:30 BST: live page ✓ · fixture invariant ✓ · submission draft opened ✓ |
| **Golden path status** | not started (TxLINE auth+data REAL ✅ via scripts/connect.mjs; product 0%) |
| **Last push** | `5d702b4` · 2026-07-18 16:44 BST |
| **Demo video** | not recorded — RECORD BY 2026-07-19 09:00 BST |
| **Submission** | no draft — open Google form draft TODAY |

## Compressed phase plan (48h playbook → 19h)

| Phase | Window (BST) | Exit |
|---|---|---|
| 1 — gap-closing | now → 18:30 | deploy smoke live · fixture invariant test green · submission form draft opened |
| 2 — spec lock | 18:30 → 19:30 | specs pushed, SCOPE FROZEN, wow moment named |
| 3 — walking skeleton | 19:30 → 01:00 | golden path end-to-end REAL (wallet sign-in → pledge → TxLINE-settled) |
| 4 — thickening | 01:00 → 07:00 | demo screens finished (loading/empty/error); checkpoints 03:00/05:30 |
| 5 — freeze + demo | 07:00 → 09:30 | video recorded + uploaded, pitch rehearsed |
| 6 — submission runway | 09:30 → 11:30 | form SUBMITTED early, links verified incognito |

## Now / Next / Done

### Now (in progress — one owner each)
- [ ] STEP 1 (human): paste local-pool Google form link/questions + confirm deploy target (Claude waiting)

### Next (unblocked, ordered)
- [ ] Fixture invariant test (pledge escrow: `sum(pledges) − payouts == vault balance`, Decimal)
- [ ] Deploy smoke: hello-world on real host, reachable from phone
- [ ] Spec lock burst (P2)

### Done (newest first, with commit)
- [x] Template promoted to root, CLAUDE.md merged, pushed (`5d702b4`, 16:44 BST)
- [x] TxLINE real auth + data proven: subscribe tx, JWT, API token, fixtures/odds/scores (`scripts/connect.mjs`, 16:33 BST)
- [x] Wallet funded 5.5 SOL devnet (`2ZEiu…Eq68`)
- [x] RUBRIC.md filled from live scrape + kickoff talk (nested-template commits, morning)
- [x] Idea picked + track locked: Track 2 primary, Social Commitment Engine (`dacb5cd`)

## Decisions made during autonomy windows

| Time | Decision | Reasoning | Needs human review? |
|---|---|---|---|
| 2026-07-18 16:47 BST | Compressed 48h playbook to 19h runway | Local pool deadline Sat 12:00 BST is binding (RUBRIC §0) | no |

## Blocked / waiting on human

- STEP 1 inputs: Google form link/questions · deploy target confirmation
