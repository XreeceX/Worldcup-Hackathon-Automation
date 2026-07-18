About TxLINE
TxLINE is a high-performance data layer providing real-time sports data and consensus betting odds. It features a single, normalised JSON schema across all competitions, allowing you to scale your application seamlessly from local matches to international tournaments.

Track Description
TxLINE streams real-time World Cup data—including scores, match events, and odds—backed by cryptographic signatures anchored on Solana. This track invites developers to leverage these data streams to build prediction platforms, consumer sportsbook interfaces, or data dashboards.

This track is open-ended to accommodate a variety of backend structures:

Data-Driven Web3 Platforms: You can build an application that utilizes our high-speed SSE Stream to power frontend user interfaces, using incoming match updates to dynamically trigger prediction resolutions on your platform.

Experimental Verification Layer (Optional): Developers can use TxLINE's publicly verifiable cryptographic Merkle proofs (such as the scores validation primitive) to verify match data signatures. If your team chooses to design independent, custom check gates or validation logic using these primitives, your effort will be highly valued by the judges.

Architectural considerations:
No P2P Asset Transfers: The internal TxLINE credit token is strictly locked to our program for data-authorization and cannot be used by contestants or end-users for peer-to-peer staking, wagering pools, or wallet transfers.

Permissionless results validation: Teams are highly encouraged to build trustless, peer-to-peer wagering pools, smart contract escrows, and decentralised AMMs. Contestants can use TxLINE cryptographic Merkle proofs to build on-chain settlement engines that unlock funds and execute transfers natively on Solana on other coins than TxLINE.

Custom On-Chain Settlement Engines: Contestants are invited to write custom on-chain settlement logic. Your smart contracts would utilize Cross-Program Invocations (CPIs) into TxLINE's validate_stat instruction to confirm match outcomes trustlessly and automate contract releases.

Ideas to get started
Full-Tournament Auto-Market: A platform designed to automatically organise, display, and resolve standard winner, total goals, or first scorer predictions across the 104-match tournament schedule using the incoming TxLINE stream.

Verifiable Resolution UI: A feature that saves or displays the data "receipt" or Merkle proof from TxLINE's feed, giving users a clear, traceable record of the match outcome without needing to trust an external oracle.

Prediction Market Viewer: A clean dashboard or analytics interface that tracks active volumes, changing liquidity, or shifting odds across World Cup prediction spaces, updating implied probabilities using the real-time feed.

Decentralized Prediction Markets & AMMs: Build an Automated Market Maker or order-book exchange that holds user funds (such as USDC) in escrow. When an event concludes, a user or keeper bot triggers your contract to CPI into TxLINE's validation program, trustlessly unlocking and routing funds to the winners.

Parametric Sports Insurance & Prop Bets: Create a decentralized insurance or custom prop-betting protocol where users/businesses lock collateral into a neutral PDA based on specific match criteria (e.g., "Team A Corners + Team B Corners > 10"). The protocol automatically releases payouts directly to user wallets the second a verified TxLINE proof is submitted on-chain.

Judging Criteria
Core Functionality: Does the application smoothly ingest and operate using live or simulated TxLINE data feeds?

User Experience & Use Case: Is the platform intuitive, and does it cover a compelling scenario for soccer fans or analytical users?

Code Quality & Logic: Is the application's resolution and validation code clean, well-documented, and deterministic?

Note: Submissions will be evaluated heavily based on the demo video. Since the matches will end after the submission deadline, there may not be live activity on the project during review. Please make sure your demo clearly showcases the product experience, user flow, and core functionality.

Ideal Submission and Eligibility
A deployed (mainnet or devnet) build using TxLINE feeds.

Include a demo video and public repo.

Open to individuals, teams (maximum 3 members in each team), and AI agents but the submission should still be owned by a real person/team/entity eligible to receive prizes via Superteam Earn.

Must use TxLINE data as a primary data source.

Submissions must include a working build, not a concept or wireframe.

Submission Requirements
Demo Video (Up to 5 Minutes): A link (Loom/YouTube) showing the problem, live app walkthrough, and how TxLINE powers the backend. (Absolute requirement to pass initial screening)

Public Repo: A link to your Project’s public Github repo.

Application Access: A working link to your deployed website OR a functional API/Devnet endpoint for judges to test.

Brief Technical Documentation: A quick overview covering your core idea, business/technical highlights, and a list of the specific TxLINE endpoints you used.

Feedback: What was your team’s experience using the TxLINE API? (What did you like most, and where did you hit friction?)

Submissions consisting only of pitch decks, wireframes, mockups, or non-working concepts will be automatically disqualified.

Judging, Selection & Winner Process
Initial Review & Shortlisting: Following the close of submissions at July 19, 2026, 23:59 UTC, the judges will review entries and compile a shortlist of top-performing teams.

Winner Selection: Final track winners (1st, 2nd, and 3rd place for each track) will be evaluated comprehensively against the specified tracking criteria and announced shortly after the live interview rounds.

Post-Hackathon Support: Distribution of stablecoin prizes and subsequent engineering/ecosystem support will be officially provisioned following the successful conclusion of winner interviews.

Resources:
Quickstart: https://txline.txodds.com/documentation/quickstart

Developer support: Discord, Telegram

World Cup Documentation: https://txline.txodds.com/documentation/worldcup


Exclusive Hackathon Access: TxODDS is waiving all commercial data fees for this event. Live, premium World Cup match feeds are fully accessible at zero cost through Saturday, July 19, 2026 (23:59 UTC).

Notes:

Participants are responsible for ensuring their submissions comply with all applicable laws and regulations, including gambling, gaming, financial, consumer protection, and securities laws in their jurisdiction. TxLINE and Superteam Earn do not endorse or authorise illegal betting, wagering, or financial activity.

By participating in this hackathon, all participants agree to the TxODDS Hackathon Terms & Conditions, in addition to Superteam Earn’s standard terms and platform rules. Please review the full T&C document before entering.

We want TxLINE to be the ultimate data layer for sports and betting apps. As you build over the course of this hackathon, your feedback is incredibly valuable to us!

Found a bug or disliked a specific endpoint? Let us know in the chat so our team can jump in and fix it for you in real-time.

Love the schema? Let us know what worked in the submission form on Superteam Earn.