# RUBRIC.md — Judging Reverse-Engineering (filled 2026-07-18 from live listing pages)

Sources: https://superteam.fun/earn/hackathon/world-cup/ · https://superteam.fun/earn/listing/trading-tools-and-agents · https://txline.txodds.com/documentation/quickstart (all scraped 2026-07-18 ~11:40 UTC). Re-read this before every scope decision.

## 0. Event clock (⚠ COMPRESSED — local deadline is the binding one)

| Milestone | Time |
|---|---|
| Submissions opened (global) | June 24, 2026 15:00 UTC |
| **LOCAL submission deadline (London IRL — HARD, nothing accepted after)** | **July 19, 2026 12:00 BST — organizer recommends submitting by 11:30** |
| Local judging period | July 19 afternoon |
| Local finale event | July 19, 17:30 BST (afterparty 20:00) |
| Global submissions close | July 19, 2026 23:59 UTC |
| Global winner announcement | July 29, 2026 15:00 UTC (after live interview rounds) |
| Free TxLINE premium access ends | July 19, 2026 23:59 UTC |

⚠ Transcript said "tomorrow at 12pm" (= Sat Jul 19) but also once said "12pm Sunday" — organizer likely misspoke; treat **Sat Jul 19 12:00 BST as binding** and verify at the venue.

78 submissions already in on Track 3 at scrape time. Global judging happens AFTER close via shortlist → **live interviews** → winners.

## 0b. London IRL event (Encode Hub) — from kickoff talk, July 18

**Two prize pools, two signups — BOTH required:**
- Global pool $50k → submit on Superteam Earn (QR codes around venue).
- **Local London pool $5k → ALSO fill the local-eligibility Google form** (QR codes at venue). No form = not eligible for local prizes.

**Rules stated at kickoff (stricter/clearer than the listing):**
- Teams 1–3 people, individuals and companies fine.
- Multiple tracks allowed but each entry must be a **completely different project** — same project in two tracks is disallowed.
- One team can win multiple prizes, only with different projects.
- **Projects must be NEW — built during the hackathon.** No pre-built work.

**On-site resources:**
- TxODDS people at venue all day: **Jake (commercial team)** and **Aidan (blockchain team)** — go ask them for TxLINE credential help and API questions. TxODDS office is ~20m from the Hub.
- Hosted by Encode (London hub) with Solana + Superteam UK.
- Data provenance (pitch color): odds/data collected by TxODDS' live team in Chicago; 20–25 yrs supplying sportsbooks/market makers; first time this enterprise B2B data is open to builders.

**Logistics:**
- Hub open 24/7 through the event; **wristband required for re-entry** (especially overnight — front desk may be unstaffed; lost band → front desk while staffed).
- Hacking areas: this floor, lower ground, workshop room (upstairs); use the back staircase.
- Food: lunch ~13:00, snack 15:00, dinner later (today); more food tomorrow.
- Rooftop party tonight 17:00–23:00 (ticketed, separate event) — back stairwell only from ~16:00.
- Zero-tolerance code of conduct.

## 1. Stated mark scheme (verbatim from the Track 3 listing — no weights published)

| Weight | Criterion | Their exact wording |
|---|---|---|
| n/a | Core Functionality & Data Ingestion | "Does the agent or automated tool smoothly run and execute decisions using live or simulated TxLINE data feeds?" |
| n/a | Autonomous Operation | "Is the tool fully automated, executing its programmatic logic without requiring manual human input or intervention once deployed?" |
| n/a | Logic & Code Architecture | "Is the underlying decision-making logic clean, deterministic, well-documented, and mathematically or strategically defensible?" |
| n/a | Innovation & Novelty | "Does the submission represent a genuinely new, creative approach to algorithmic sports tracking, market analysis, or autonomous interaction?" |
| n/a | Production Readiness | "Is the tool robust enough that a professional trading team, market operator, or B2B intermediary could realistically deploy it in a live production environment." |

> **Sponsor's stated emphasis (verbatim):** "Submissions will be evaluated heavily based on the demo video. Since the matches will end after the submission deadline, there may not be live activity on the project during review. Please make sure your demo clearly showcases the product experience, user flow, and core functionality." → The demo video IS the product at review time.

## 2. Tracks / prizes (VERBATIM one-line definitions)

| Track | Exact sentence from organizers | Prize |
|---|---|---|
| Prediction Markets and Settlement | "The flagship track. Markets, resolution and settlement built on verifiable World Cup data: outcome markets, oracle tooling, on-chain proof integrations." | $18,000 USD |
| Consumer and Fan Experiences | "Build fan-facing World Cup apps, games, bots, or social experiences that use TxODDS' live match data to update instantly during games and keep fans engaged." | $16,000 USD |
| **Trading Tools and Agents (OURS)** | "Create autonomous agents that ingest TxODDS' live odds and scores, detect signals, run strategies, and execute decisions without manual input." | **$16,000 USDT (10k / 4k / 2k)** |

> **Rule: build the track sentence.** Pick the track FIRST, quote its sentence at the top of the spec, and map every feature to it.

Sponsor's own starter ideas for Track 3 (signals what they expect): Sharp Movement Detector (poll odds every 60s, flag shifts, track prediction accuracy) · Agent vs Agent Arena (opposite strategies, on-chain settlement) · In-Play Market Maker (quote buy/sell on in-play outcomes).

## 3. Judges (names, roles, employers)

| Judge | Role | What they'll probe |
|---|---|---|
| Not published on listing | TxODDS team judges; winners face **live interview rounds** before final selection | Expect probing on autonomy claims, TxLINE endpoint usage, and whether logic is "mathematically or strategically defensible" |

## 4. Submission requirements (verbatim list from listing — ALL required)

- [ ] **Demo video, ≤5 min** (Loom/YouTube link): problem → live app walkthrough → how TxLINE powers the backend. "Absolute requirement to pass initial screening."
- [ ] **Public GitHub repo** link.
- [ ] **Application access**: working deployed-site link OR functional API/devnet endpoint judges can test.
- [ ] **Brief technical documentation**: core idea, business/technical highlights, list of specific TxLINE endpoints used.
- [ ] **Feedback** on TxLINE API experience (what we liked, where we hit friction).
- Auto-disqualified: pitch decks / wireframes / mockups / non-working concepts only.

### Eligibility & rules
- Individuals or teams of **max 3**; AI agents may build but submission must be owned by a real person/entity eligible on Superteam Earn.
- Project must be a **running agent or tool, live or on devnet**, ingesting TxLINE feeds and executing a defined strategy. "Clear logic and a working system beats a polished demo with neither."
- **Must integrate TxLINE data as a live input.**
- Comply with gambling/financial laws of our jurisdiction; agree to [TxODDS Hackathon T&C](https://txline.txodds.com/documentation/legal/hackathon-terms). Community flag: T&C §5.1 says entries must be human-created/submitted — human owns and submits ours.
- Submission via Superteam Earn (login/signup + wallet via Privy).

## 4b. TxLINE API access (from quickstart — needed BEFORE first real call)

- Auth is **on-chain**: Solana wallet → on-chain `subscribe` tx → sign activation message → API token. Even the free tier needs the subscribe tx (devnet SOL covers fees — airdrop first).
- **Free World Cup tier**: service levels 1 or 12, no TxL token purchase. Guide: https://txline.txodds.com/documentation/worldcup
- Devnet: program `6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J`, API base `https://txline-dev.txodds.com/api/`, guest auth `https://txline-dev.txodds.com/auth/guest/start`. Mainnet: program `9ExbZjAapQww1vfcisDmrngPinHTEfpjYRWMunJgcKaA`, API base `https://txline.txodds.com/api/`. Never mix hosts across networks.
- Two credentials per data request: `Authorization: Bearer <guest JWT>` (renewable) + `X-Api-Token: <activated token>`. 401 → renew JWT, same api token. 403 on activation → check message/wallet/network.
- Runnable devnet examples (free-tier activation, odds/scores streams): https://txline.txodds.com/documentation/examples/devnet-examples
- Docs index for machines: https://txline.txodds.com/llms.txt · API reference: https://txline.txodds.com/api-reference/authentication/start-a-new-guest-session
- Support: Discord https://discord.gg/txodds · Telegram https://t.me/TxLINEChat (also the listing's official contact)

## 5. The unwritten layer (verified against July 2026 recorded winners — assume it applies)

The written rubric above decides who reaches the final. These decide who WINS:

- [ ] **Real niche with a face** — a named person/business the judge can picture (use YOUR real company)
- [ ] **Agentic framing** — an agent doing work autonomously within explicit policy bounds ("most of what wins is agentic AI" — organizer, on record) — *here it's the WRITTEN rubric too (criterion 2)*
- [ ] **Sourced problem statistics** — 2–3 numbers judges can't argue with, spoken in the first 30 seconds
- [ ] **One live wow moment** — a 10-second visible proof (live connect, real write landing, balance hitting zero)
- [ ] **Human-in-the-loop as a trust feature** — approval gates presented as a strength, never an apology — *frame carefully: rubric demands "without manual input ONCE DEPLOYED"; gates belong at policy level, not per-decision*
- [ ] **Sponsor-tool visibility** — TxLINE endpoints named on screen; the Solana anchoring shown, not just claimed
- [ ] **3-minute comprehension** — a judge who missed the first 90 seconds can still explain the product
- [ ] **Honest Q&A** — admitted gap + roadmap beat bluffing on record; prepare answers in `PITCH.md` (live interview round confirmed for this event)
- [ ] **Feedback field is scored attention** — sponsor explicitly wants API friction reports; log every rough edge as we integrate and hand it in

## 6. Anti-checklist (verified UNDER-rewarded on record — cap effort here)

- Architecture depth / test count beyond green-and-stable (least-enforced axis in the recordings)
- UI polish beyond the demo camera path
- Feature breadth (the team challenged hardest overlapped an existing platform feature; "one killer feature beats five half-built ones")
- Live activity during review — impossible anyway (matches end before judging); the ≤5-min video carries everything
