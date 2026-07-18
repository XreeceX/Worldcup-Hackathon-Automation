# PITCH.md — The 3-Minute Pitch (start day 1, rehearse day 2)

Format observed at the last event: **3 minutes pitch + 1 minute judge Q&A.** Timing discipline is scored implicitly — the winner who closed exactly on time won; a finalist who ran over mid-demo needed judge charity.

## The script (fill as you build — not the night before)

| Clock | Beat | Content |
|---|---|---|
| 0:00–0:20 | **Hook — the problem, with numbers** | 2–3 sourced statistics. _"£X billion… Y businesses close every day…"_ Spoken, not on a slide the judge must read. |
| 0:20–0:45 | **The face** | YOUR real business/persona and their exact pain. First person beats hypothetical: "my spa loses N hours every month to…" |
| 0:45–2:15 | **Live demo — the golden path** | One flow, rehearsed camera path. The **named wow moment** lands by 1:45. Narrate what the judge is seeing, not what the code does. |
| 2:15–2:40 | **How it works** | One breath: agentic loop + policy-bounded autonomy + sponsor tools used. Name the real API writes. |
| 2:40–3:00 | **Close** | Track sentence, said back to them: "This is [track definition] for [niche]." Then stop talking. |

**Named wow moment:** _______________ (must be visible in ≤10 seconds; rehearsed live twice; has a recorded fallback)

**Fallback rule (observed working):** if the live demo dies, switch to the recorded video without apologizing — a winner did exactly this.

## Judge Q&A bank (the 6 questions asked of EVERY team on record — write answers early)

1. **"How does the [platform] integration actually work under the hood?"**
   → _answer: name the real API calls/writes, show you own them_
2. **"Did you use real webhooks, or did [automation tool] hide that from you?"**
   → _answer: be honest; admitted gap + roadmap was forgiven on record, bluffing was not_
3. **"How is your AI trained / how are these scores derived?"**
   → _answer: never leave a number unexplained — a vague "trust score" answer was the weakest moment on record_
4. **"How is this different from what [platform] already does?"**
   → _answer: know the platform's native features cold; the team that couldn't answer this conceded on stage_
5. **"How did you validate the problem?"**
   → _answer: your real business + any external stat/source_
6. **"What about [adjacent scope, e.g. bills not just invoices]?"**
   → _answer: acknowledge + place it on the roadmap in one sentence_

## The stage deck (slides the judges see · speaker notes only YOU see)

Lane D generates the deck via python-pptx **with the script embedded in each slide's speaker-notes field** — you present in Presenter View (or from a phone/printout) reading the notes while judges see only the slide. Slides are props, not scripts: a judge either reads or listens, never both — so slides carry ONE visual + ≤8 words, and every spoken word lives in the notes.

| Slide | Judges see | Your notes contain (with timecodes) |
|---|---|---|
| 1 · Hook (0:00–0:20) | ONE huge sourced stat + product name | The hook lines, verbatim · "breathe, slow start" |
| 2 · The face (0:20–0:45) | Real anchor — photo/name of YOUR business + its pain numbers | The persona story, first person |
| 3 · LIVE DEMO (0:45–2:15) | A single frame saying "Live demo" (you switch to the app) | Demo narration beats keyed to the golden path · **fallback cue: "if it dies → play the video, do not apologize"** |
| 4 · How it works (2:15–2:40) | One architecture diagram | Agentic loop + policy-bounded autonomy + the REAL writes, named |
| 5 · Close (2:40–3:00) | Track sentence + the outcome number | Closing lines · **"…and stop talking."** |
| 6 · Q&A backdrop | The proof screenshot (platform UI showing your write) | The 6 prepared answers, one line each |

Rules: max 6 slides — every extra slide steals demo time · numbers on slides must match the pushed repo · notes include the **transition cue** to the next slide so you never turn to look at the screen · rehearse twice FROM PRESENTER VIEW (the notes pane is part of the performance, not a safety net you meet on stage).

Honesty clause: nothing guarantees a win — this structure encodes what the recorded winners measurably did: comprehension in 90 seconds, one live wow, honest Q&A, closing exactly on time. It removes every known way to lose the presentation; the rest is the product and the field.

## Delivery rules

- Judges form their impression in the first ~90 seconds — the hook and the face carry the pitch.
- Rehearse out loud, timed, at least twice — once at feature freeze, once before pitching.
- One speaker per beat; hand-offs planned, not improvised.
- Bring the deck AND the video on local storage — venue Wi-Fi failed teams on record.
