# Submission Package — TIFO (Track 1: Prediction Markets & Settlement)

Everything the Superteam Earn / local London submission needs, drafted so that on deadline day this is fill-in-the-blanks, not writing. Deadlines: **local pool Jul 19 12:00 BST (primary)**; global track Jul 19 23:59 UTC (submit to both).

---

## 1. Submission checklist (from track-01 requirements)

- [ ] **Demo video ≤ 5 min** (Loom/YouTube, public link) — script in §3. *Absolute screening requirement.*
- [ ] **Public GitHub repo** — flip visibility; verify no secrets in history (`git log -p | grep -iE 'jwt|token|key'` spot check); README from §4
- [ ] **Working deployed link** — frontend on Vercel; keeper + indexer + Postgres on Railway/Fly (one box is fine); judges must be able to browse the board with **zero cost and zero wallet** (T&C: judges won't fund wallets — the no-wallet board is our safety net, plus demo-mode URL as fallback)
- [ ] **Brief technical documentation** — §2, paste-ready
- [ ] **API feedback section** — §5
- [ ] Team ≤ 3, human owner/submitter on Earn (T&C §5.1 agent-authorship caution — a real person fronts the entry)
- [ ] No FIFA marks anywhere in UI, video, or repo art
- [ ] Also file the **local London Google form** before 12:00 BST

---

## 2. Technical documentation (paste-ready draft)

**TIFO — conditional pledges settled by cryptographic proof of the final whistle.**

Fans promise things before big matches; none of it is enforceable. TIFO makes the promise a protocol: an individual fan — or an open fan collective — locks SOL behind a match condition ("France wins", "both teams score") with a beneficiary chosen upfront. When TxLINE finalises the match, our keeper fetches the Merkle proof and anyone can trigger on-chain resolution: the Anchor program CPIs into TxLINE's `validateStatV2`, and the vault either releases to the beneficiary atomically or opens pro-rata refunds. No admin key exists in the fund path. **This is not betting** — there is no counter-party, no opposing side, and the pledger wants the condition to be true; it is a conditional donation with sport as the enforcement layer.

**Highlights**
- Trustless settlement: outcome decided by `validateStatV2` CPI against TxLINE's on-chain Merkle roots — the keeper automates but cannot override
- Lazy locking: kickoff timestamp enforced by the on-chain clock at `join`/`withdraw` — no lock transaction, no race window
- Hybrid settlement: beneficiary paid atomically in the resolve tx (the headline moment); refunds are pull-based per member, so a 500-member DAO can never hit Solana's per-tx account limits
- Dual-channel finalisation: SSE stream + interval polling in parallel; permissionless manual resolve as the final fallback
- Void safety: fixture cancellation proven on-chain via `validateFixture` (`gameState=16`); 7-day clock-based timeout guarantees members an exit with no oracle dependency

**TxLINE endpoints used**
| Endpoint | Use |
|---|---|
| `POST /auth/guest/start`, `POST /api/token/activate` | auth bootstrap |
| `GET /api/fixtures/snapshot` | fixture universe, kickoff times |
| `GET /api/fixtures/updates/{epochDay}/{hour}` | cancellation detection (gameState=16) |
| `GET /api/fixtures/validation` | `validateFixture` proof for void path |
| `GET /api/scores/stream` (SSE) | `game_finalised` trigger; in-play card feed |
| `GET /api/scores/updates/{epochDay}/{hour}/{interval}` | polling fallback for finalisation |
| `GET /api/scores/stat-validation` | Merkle proof package for `validateStatV2` |
| `GET /api/scores/historical/{fixtureId}` | deterministic replay for demo/testing |
| `validateStatV2`, `validateFixture` (on-chain CPI) | trustless resolution and void |

**Stack:** Anchor (Solana devnet) · Node.js keeper · Postgres indexer (`connection.onLogs` + reconciliation) · Next.js 14 + wallet-adapter frontend.

---

## 3. Demo video script (5:00 hard cap — target 4:30)

**Recorded entirely in replay mode** against fixture `18241006` (England vs Argentina — BTTS met). No live-match capture is planned — the video must never depend on one. Beats 4–5 (live score, lock moment, condition flip) are driven by the keeper's replay event bus; on camera this is indistinguishable from live, and the narration should say plainly "we're replaying a real finalised World Cup fixture through the identical pipeline" — honesty here reads as engineering confidence, not weakness.

| Time | Beat | On screen |
|---|---|---|
| 0:00–0:25 | **Problem + claim.** "Every World Cup, fans make millions of promises. Zero are enforceable. TIFO turns a fan's promise into a protocol. And no — it's not betting: no counter-party, no odds, the beneficiary is chosen upfront." | Board alive: ticker scrolling, stat tiles rolling |
| 0:25–1:05 | **Create a pledge** in one take, < 40s. Call out the shootout disclosure and the unverified-address warning as *features* ("we tell you exactly what you're signing"). | Wizard steps 1–3, stamp animation, card appears on board |
| 1:05–1:40 | **A collective forms.** Second wallet joins the DAO on camera; member row flashes in; total rolls up. "Joining is co-signing. No vote, no committee — membership is the commitment." Withdraw shown once, pre-kickoff. | Commitment page Zone B |
| 1:40–2:30 | **Match goes live.** Countdown → LOCKED moment → goal, digits roll → ConditionStatus flips to MET with the check-ring. "This is TxLINE's stream, and the same data is being anchored to Solana as Merkle roots — which matters in a moment." | Match Center |
| 2:30–3:30 | **The settlement.** Full time → "awaiting settlement" heartbeat → keeper log split-screen (game_finalised → proof fetch with real `seq` → resolve tx) → **ceremony fires: gold count-up, confetti** → linger 2 full seconds on the **Proof Receipt** → click through to Solana Explorer, show the CPI in the tx. "No human decided this. A Merkle proof did." | Ceremony + receipt + explorer |
| 3:30–4:00 | **The NO path.** Pre-staged losing commitment: refund banner, claim, rent-back note. "When the condition fails, the protocol keeps its other promise — everyone gets their money back, forever claimable." | Claims page |
| 4:00–4:30 | **Zoom out.** Board full of settled receipts; one-line architecture (program / keeper / indexer); "built in 24h on TxLINE + Solana devnet; the settlement engine is 400 lines of Anchor and the trust model fits in one sentence." End card: repo + live URL. | Architecture slide, end card |

Recording rules: 1080p minimum, cursor deliberate, no dead air over 3s, captions burned in (judges may watch muted), every on-chain claim followed by an explorer frame.

---

## 4. README skeleton (public repo)

`TIFO — put it on the line` · one-paragraph pitch (§2 first paragraph) · GIF of the ceremony · **Live demo** link + demo-mode link · architecture diagram (design doc §3) · quickstart (env table from design §7.1, `anchor test`, three `npm run` targets: keeper / indexer / web) · TxLINE endpoints table · trust model ("what can't we do?") · repo map · license.

## 5. API feedback draft (sponsor explicitly rewards this)

**Liked:** normalised schema across feeds; free WC tier with real on-chain anchoring; historical replay endpoint made deterministic e2e testing of the proof pipeline possible — the single best DX feature of the hackathon; devnet level-1 being ~real-time.
**Friction:** stat-key period-prefix docs — boilerplate labels `3001` as ET goals but the formula says H2; `seq=0` silently invalid rather than rejected loudly; `validateStatV2` predicates can't express addition across keys (forced us to descope "Total goals ≥ N" — V3 multiproof docs/examples would unlock it); packed `gameState` in `FixtureId` (÷2^48) deserves a first-class field; SSE stream benefits from a documented heartbeat so clients can distinguish quiet from dead.

*(Rewrite in the team's own words after the build — include at least one fresh, real friction point from the actual 24 hours; specificity here is credibility.)*
