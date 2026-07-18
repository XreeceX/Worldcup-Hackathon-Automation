# SUBMISSION.md — Checklist with Time Gates

The submission is a deliverable with its own schedule, not a last-hour chore. Last event this was left to the final hour: the video was rushed, the strongest narrative and all screenshots never reached the pushed repo, and organizers on record struggled to even FIND some teams' submissions. Free points were dropped. Never again.

## Time gates

| Gate | Deadline | Action |
|---|---|---|
| G1 | **Day 1 (T+6)** | Submission draft exists in the real portal (placeholder text is fine) + this file filled with the requirements list from `RUBRIC.md` §4 |
| G2 | **T+30** | README tells the current true story; screenshots of the working golden path committed and pushed |
| G3 | **T+36** | Demo video recorded, uploaded, linked from README and the portal draft |
| G4 | **T+42** | Code freeze. Submission copy finalized. Push after EVERY edit from here on |
| G5 | **T+46 (= 2h early)** | Final submission SUBMITTED. Never race the cutoff |

## The package — FILLED from the live Superteam Earn listing (pasted 2026-07-18 16:55 BST)

**Portal:** Superteam Earn → "World Cup — Consumer and Fan Experiences by TxODDS" (Track 2, $16k pool: 10k/4k/2k). 92 submissions as of 16:55 BST Jul 18. Winner announcement Jul 29 15:00 UTC.
**Deadlines:** London local pool **Sat 19 Jul 12:00 BST (submit 11:30)** · global portal Sat 19 Jul 23:59 UTC.

Required items (verbatim from listing):
- [ ] **Demo Video ≤5 min** (Loom/YouTube link): problem → live app walkthrough → how TxLINE powers the backend. *"Absolute requirement to pass initial screening."* Video is weighted heaviest — matches end before review, so the video IS the product.
- [ ] **Application Access**: working link to deployed website OR functional API endpoint judges can test (devnet OK).
- [ ] **Brief Technical Documentation**: core idea, business/technical highlights, **list of specific TxLINE endpoints used**.
- [ ] **Feedback**: team's TxLINE API experience — liked most + friction points (log kept in RUBRIC.md §feedback as we build).
- [ ] **Public repo link** — pushed HEAD must match every claim.

Eligibility gates (hard):
- Product must be **functional, not mockup** — decks/wireframes auto-disqualified.
- **TxLINE data as a live input** + **sign up through Solana** (wallet sign-in).
- Works during a match. Max 3 team members. Owned by real person on Superteam Earn.

## Final verification ritual (do ALL, in order, before G5)

1. `git status` → clean. `git log origin/main..HEAD` → empty (nothing unpushed).
2. Open the pushed repo in an incognito browser — is the README the story you want a judge to read? Do the screenshots render?
3. Click every link in the portal draft from incognito: video plays, deck opens, live URL loads, repo is accessible.
4. Read the portal text once out loud. Numbers in it must match the pushed repo (test counts, features — no aspirational claims).
5. Submit. Screenshot the confirmation.

## The demo shot list (how the video gets made — lane D produces it at G2/T+30)

The video is produced from a **shot list**: one card per shot, each carrying the real screenshot of the target state, the on-screen ACTION, and the exact SAY line. Record per shot (any flub redoes one shot, never the take), dub voice separately, assemble with straight cuts. Claude generates the document with embedded verified screenshots; the human performs it.

**Length rule:** the submission video has NO fixed duration — its length is set by feature coverage: every built feature appears, none is rushed, and there is zero filler. (Check the event's rules for a hard cap; absent one, coverage decides. The 3-minute limit applies to the STAGE pitch, which is a separate, tighter artifact — see PITCH.md.)

**The three-act structure:**
1. **ACT 1 — The problem (slide shots):** 2–4 deck slides as full-frame shots — the real-world pain, the impact numbers (sourced stats), the REAL anchor (your business/person/event). No app on screen yet; make them feel the wound.
2. **ACT 2 — The turn (bridge shot):** one beat introducing the app as the answer — hero screen or one slide: "this is how we fix it."
3. **ACT 3 — The features, in journey order:** walk EVERY built feature as chapters of the user's story — the order the persona would actually encounter them (per spec 01 §4), not a feature-list order. Each chapter: app shots + its external-proof shot where a write lands. Close on the outcome state (the restored numbers), not on a feature.

**Continuity rule — write the narration FIRST, slice second.** The transcript is written as ONE continuous script (a story with a beginning: the pain → middle: the golden path → end: the outcome), read aloud once to check it flows, THEN sliced into shot windows sized at ~150 wpm. Never write per-shot lines independently — that produces six disconnected captions instead of a narration.

**Shot types (mix them — this is what separates a demo from a screen recording):**
- **App shots** — the golden path in your product (the core).
- **External-proof shots** — the sponsor platform's REAL UI showing your writes landed: the created invoice with its ID, the transaction list, the account balance. *(The recorded judges' most-asked question was "how does the [platform] part actually work?" — a cutaway to the real Xero screen answers it before it's asked. This is the highest-value 3 seconds in the video.)*
- **Insert shots** — one slide/diagram frame if a concept needs it (architecture, the invariant math). Max one or two.
- **Anchor shot** — the real persona/business context if you have it (a photo, the actual marketplace statement).

**Per-shot card format:** `SHOT n · timecode · duration` + SCREEN (state that must be visible before rolling) + ACTION (what the hand does) + SAY (validated line) + the reference screenshot.

**Validation before recording:** every SAY line is timed at ~150 wpm against its window (TTS proxy or stopwatch); every SCREEN state is captured as a reference screenshot first. A shot list with untimed lines or imagined screens is a draft, not a shot list.

## Anti-patterns (all observed)

- "I'll polish the docs after the code freeze and push once at the end" → the push never happened.
- Recording the demo video in the last hour → rushed, unfinished frontend on camera.
- Numbers in the submission that the pushed repo can't back up (claimed test count ≠ committed test count).
- A zip/artifact of the repo uploaded instead of the repo link staying current.
