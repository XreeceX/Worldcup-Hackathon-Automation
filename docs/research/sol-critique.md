## HONEST SCORE /100

**43/100 today**, using equal 20-point weighting.

| Criterion | Score | Reason |
|---|---:|---|
| Fan Accessibility & UX | 8/20 | The claimed three-tap pledge becomes match selection, condition building, beneficiary selection, funding and wallet signing, with little reason to reopen after committing. [idea-01.md](/Users/supavichaussawaauschariyakul/dev/worldcup-hackathon2/docs/ideas/idea-01.md:130) |
| Real-Time Responsiveness | 7/20 | The architecture reacts to `game_finalised`, not actively unfolding play, despite the criterion explicitly demanding fluid in-match updates. [track-02.md](/Users/supavichaussawaauschariyakul/dev/worldcup-hackathon2/archieve/tracks/track-02.md:17) [idea-01.md](/Users/supavichaussawaauschariyakul/dev/worldcup-hackathon2/docs/ideas/idea-01.md:112) |
| Originality & Value Creation | 17/20 | Enforcing a social or charitable promise from verifiable match data is a distinct fan interaction rather than another scores interface. [idea-01.md](/Users/supavichaussawaauschariyakul/dev/worldcup-hackathon2/docs/ideas/idea-01.md:9) |
| Commercial & Monetization Path | 7/20 | Protocol fees, sponsored DAOs and white-label sales are named, but there is no buyer, price, unit economics, charity onboarding or custody plan. [idea-01.md](/Users/supavichaussawaauschariyakul/dev/worldcup-hackathon2/docs/ideas/idea-01.md:168) |
| Completeness & Execution | 4/20 | TxLINE ingestion works, but the product is 0%, deployment is undecided and no video exists, while the track requires a functional app and testable link. [TODO.md](/Users/supavichaussawaauschariyakul/dev/worldcup-hackathon2/TODO.md:12) [track-02.md](/Users/supavichaussawaauschariyakul/dev/worldcup-hackathon2/archieve/tracks/track-02.md:27) |

## TOP-3 UPGRADES

1. **Ship one complete individual pledge loop. Estimate: 6 to 7 hours.** One fixture, one fixed condition, one beneficiary, devnet SOL, wallet signature, TxLINE resolution, transfer and explorer link. Use keeper custody if the custom program misses its 30-minute compile gate. This raises UX and completeness faster than any extra feature.

2. **Make match events visibly change the product. Estimate: 2 to 3 hours.** Show the live score, condition progress and TxLINE event log; replay captured real TxLINE payloads for the video, clearly labelled as a replay, then let `game_finalised` trigger the real devnet transfer. A final-whistle-only integration will lose the real-time criterion. [track-02.md](/Users/supavichaussawaauschariyakul/dev/worldcup-hackathon2/archieve/tracks/track-02.md:17)

3. **Build and record the judging artifact before general polish. Estimate: 3 to 4 hours.** Deploy the camera path, record a full take with the TxLINE endpoint names and Solana explorer proof on screen, state keeper custody honestly, and show simple fee math for a sponsored pledge. The organizers say the video carries the review. [RUBRIC.md](/Users/supavichaussawaauschariyakul/dev/worldcup-hackathon2/RUBRIC.md:55)

## KILL LIST

- **Second Track 1 submission:** Kill it. Kickoff rules say the same project cannot enter multiple tracks, directly contradicting the two-submission plan. [RUBRIC.md](/Users/supavichaussawaauschariyakul/dev/worldcup-hackathon2/RUBRIC.md:27) [idea-01.md](/Users/supavichaussawaauschariyakul/dev/worldcup-hackathon2/docs/ideas/idea-01.md:151)
- **Fan DAO mode:** Kill it. `join`, pooled custody, membership accounting, lock timing and pro-rata refunds multiply failure paths without improving the five-minute story. [idea-01.md](/Users/supavichaussawaauschariyakul/dev/worldcup-hackathon2/docs/ideas/idea-01.md:30)
- **Custom condition language:** Kill it. Offer one fixed win condition, or at most three templates; multi-leg composition creates UX, proof and testing work that judges will barely see. [idea-01.md](/Users/supavichaussawaauschariyakul/dev/worldcup-hackathon2/docs/ideas/idea-01.md:81)
- **Anchor program:** Give it one 30-minute smoke test, then kill it if create and resolve do not compile. Use backend-keeper custody and stop claiming trustless escrow, permissionless resolution or contract-enforced execution. [idea-01.md](/Users/supavichaussawaauschariyakul/dev/worldcup-hackathon2/docs/ideas/idea-01.md:42)
- **USDC support:** Kill it for the demo. The funded wallet already has devnet SOL; token minting, associated accounts and balances are avoidable failure points. [TODO.md](/Users/supavichaussawaauschariyakul/dev/worldcup-hackathon2/TODO.md:40)
- **Odds and implied probability:** Kill it. It drags the story toward betting and adds an endpoint that contributes nothing to the core promise. [idea-01.md](/Users/supavichaussawaauschariyakul/dev/worldcup-hackathon2/docs/ideas/idea-01.md:120)
- **Full social discovery surface:** Kill sorting by cause, condition, group and pledge size. One current pledge card plus one recent-settlement feed is enough. [idea-01.md](/Users/supavichaussawaauschariyakul/dev/worldcup-hackathon2/docs/ideas/idea-01.md:97)
- **Production lifecycle machinery:** Kill `Draft`, `Open`, `Locked`, `Void`, `claim`, cancellation handling and general refund logic. Demo only `pending`, `condition met`, `transferred` and `failed`.

## PITCH ANGLE

Open with one fan saying, "If Argentina wins, I send 0.1 SOL to this youth-football wallet." They connect Solana and commit in under 30 seconds. A real TxLINE event changes the condition card while the judge watches; finalisation triggers the devnet transfer, and the Solana explorer link appears. Frame the product as turning a public football promise into a public action. Do not lead with protocols, DAOs, Merkle trees or condition languages. End with the business: brands sponsor pledge cards and pay a fee when commitments complete. If keeper custody is used, say so plainly and describe program-owned escrow as the production path. The sentence judges should remember is: **"When the result becomes true, the promise becomes a transaction."**

## PLAN ATTACK

1. **The walking skeleton assumes the riskiest dependency will work.** Product is at 0%, yet Phase 3 gives 5.5 hours to wallet, pledge, uncertain Anchor code and TxLINE settlement. [TODO.md](/Users/supavichaussawaauschariyakul/dev/worldcup-hackathon2/TODO.md:21) **Mitigation:** run the Anchor smoke test immediately; after 30 minutes, lock keeper custody, individual mode, devnet SOL and one condition.

2. **The plan mistakes final settlement for real-time fan engagement.** Phase 4 budgets six hours for generic loading, empty and error screens, while the current architecture does nothing visible until `game_finalised`. [TODO.md](/Users/supavichaussawaauschariyakul/dev/worldcup-hackathon2/TODO.md:23) **Mitigation:** require an in-play score or event to alter the pledge card before midnight; polish only the recorded path after that works.

3. **Deployment and video are scheduled after the remaining recovery margin has disappeared.** GitHub Pages can host the frontend, but it cannot run the keeper or protect TxLINE credentials; deployment remains undecided until 07:00, when video recording is supposed to be underway. [TODO.md](/Users/supavichaussawaauschariyakul/dev/worldcup-hackathon2/TODO.md:25) [TODO.md](/Users/supavichaussawaauschariyakul/dev/worldcup-hackathon2/TODO.md:36) **Mitigation:** choose backend hosting during spec lock, deploy a skeleton before 23:00, record a rough complete take by 05:00, freeze code by 07:00 and submit by 09:00.
