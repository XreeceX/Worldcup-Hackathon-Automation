# Requirements — Social Commitment Engine

## Overview

The Social Commitment Engine is an on-chain protocol that lets fans and fan communities lock conditional pledges against World Cup match outcomes before a game starts. If the stated condition is met when the final whistle blows, the escrowed funds are automatically released to a pre-designated beneficiary. If not, funds are returned. Resolution is driven by TxLINE's cryptographic proof of the match result — automated, verifiable on-chain, with no counter-party and no committee. The protocol is structurally distinct from betting: there is no counter-party, and pledgers are always rooting for the condition to be true.

---

## Actors

| Actor | Description |
|---|---|
| **Pledger** | A fan who creates and funds an individual commitment |
| **DAO Founder** | Creates a group commitment open to additional members |
| **DAO Member** | Joins an open group commitment by depositing funds before kickoff |
| **Beneficiary** | The wallet or cause that receives funds if the condition is met |
| **Resolver** | Any wallet that triggers permissionless resolution after match finalisation |
| **Observer** | Anyone browsing the public board — no wallet required |

---

## Core Concepts

**Commitment** — a conditional escrow tied to a specific match outcome. Can be individual (one pledger) or group (multiple members). Both are the same underlying structure. Each commitment stores the fixture's kickoff timestamp at creation time, used to enforce the membership cutoff without a discrete lock transaction.

**Condition** — a stat-based predicate over a specific fixture. Composed from TxLINE stat keys at creation time, then immutable. Examples: "Brazil scores more than 2 goals", "no red cards in the match", "both teams score AND total goals under 5".

**Vault** — the escrow holding committed funds. Held by the protocol until resolution or void.

**Group (Fan DAO)** — a commitment with an open membership period. Any wallet that deposits before kickoff becomes a co-signer. Joining is the commitment — there is no separate vote.

**Resolution** — the automated, proof-driven determination of whether a condition was met. Driven by TxLINE's Merkle proof and verifiable on Solana.

---

## Functional Requirements

> **Build priority note:** Implement individual commitments (FR-1, FR-2, FR-4–FR-8, FR-13) as the first vertical slice — this covers the full TxLINE proof pipeline and is a shippable product on its own. Group/DAO features (FR-3 and DAO-specific paths in FR-4, FR-7) are additive and should only be started once the individual loop is green end-to-end.

### FR-1: Commitment Creation

- FR-1.1 — A pledger must be able to create an individual commitment for any upcoming fixture.
- FR-1.2 — A commitment must specify: the fixture, the condition, a beneficiary address, and an initial deposit amount. The fixture's kickoff timestamp must be recorded on-chain at creation time.
- FR-1.3 — A DAO Founder must be able to create a group commitment with the same required fields, leaving membership open until kickoff.
- FR-1.4 — Individual and group commitments must share the same condition and resolution mechanics.
- FR-1.5 — The deposit currency is devnet SOL. No token mint, associated token account, or SPL token program interaction is required at any point in the protocol. The vault holds lamports; settlement and refunds use system program transfers.

### FR-2: Condition Templates

- FR-2.1 — Conditions must be selected from a fixed set of templates presented in human-readable form. There is no free-form condition composer.
- FR-2.2 — The initial template set is:
  - **Both teams score** — home goals > 0 AND away goals > 0
  - **Total goals ≥ N** — total goals at full time ≥ a pledger-specified integer N
  - **Team wins** — the selected team has more goals than the opponent at full time, including extra time. A match settled by penalty shootout after a draw does not satisfy this condition. The UI must disclose this limitation at condition selection time.
- FR-2.3 — The template set is designed to be expandable. Adding a new template must not require changes to the resolution or proof pipeline — only a new `validateStatV2` payload mapping.
- FR-2.4 — Conditions must be immutable once the commitment is created. There is no edit window before kickoff.

> **Rationale:** A composable condition language (multi-leg AND logic across arbitrary stat keys) adds UI, proof construction, and testing surface that is invisible in a 5-minute demo video. Fixed templates convey the same concept — a fan picks a condition, funds lock, funds move — with a fraction of the build cost. Expandability is preserved by keeping the template-to-payload mapping as the only extension point.

### FR-3: Group Membership

- FR-3.1 — Any wallet must be able to join an open group commitment before kickoff by depositing funds.
- FR-3.2 — Joining a group constitutes co-signing its condition and beneficiary — no separate approval or vote is required.
- FR-3.3 — No new members may join at or after the kickoff timestamp. This is enforced at the join instruction by comparing the on-chain clock against the stored kickoff timestamp — no discrete lock transaction is required.
- FR-3.4 — A member's deposit amount must be recorded at join time and used to calculate their pro-rata share at claim time.
- FR-3.5 — A group commitment may have a maximum of 500 members. The `join` instruction must reject with a clear error once this cap is reached. Account space for the maximum member list must be pre-allocated at commitment creation.

- FR-3.6 — Any member, including the DAO Founder, may withdraw their full deposit before the kickoff timestamp. Withdrawal is enforced by the same on-chain clock check as `join`.
- FR-3.7 — Withdrawal removes the member from the commitment entirely. Partial withdrawal is not permitted — a member withdraws their full deposit or nothing.
- FR-3.8 — A member who has withdrawn may not rejoin the same commitment.
- FR-3.9 — If the last member withdraws, the commitment must be automatically closed. No further instructions (join, resolve, void) may be called on a closed commitment.

> **Rationale (FR-3.5):** The pull-based refund model (FR-7) eliminates the settlement compute problem, so the cap is not about atomicity. It exists to prevent spam (one entity flooding a DAO with dust-deposit wallets inflating member count) and to make account size predictable and pre-allocatable. 500 was chosen as generous enough for any realistic fan community while keeping the pre-allocated account footprint bounded at ~20KB.
>
> **Rationale (FR-3.6–3.9):** "Join = commit" is the social framing, but withholding the right to change one's mind before the game starts would deter participation. Withdrawal is scoped strictly to before kickoff — the same boundary enforced by lazy locking — so it cannot be used to escape a commitment once the match is underway. Allowing the founder to withdraw like any other member keeps the rules uniform; if they are the last member, closing the commitment avoids a permanently empty vault with no resolution path.

### FR-4: Commitment Lifecycle

Commitments must transition through the following states only:

```
OPEN → RESOLVED_YES | RESOLVED_NO → EXECUTED | REFUNDED
  ├──→ VOID (fixture cancellation verified via validateFixture CPI)
  └──→ VOID (timeout: 7+ days past kickoff with no resolution)
```

- **OPEN** — commitment is live. Deposits and group membership are accepted if the on-chain clock is before the kickoff timestamp. After kickoff, the commitment is effectively closed to new activity but remains OPEN until resolution.
- **RESOLVED_YES** — condition verified as met; vault released to beneficiary atomically in the same resolve transaction.
- **RESOLVED_NO** — condition verified as not met; commitment enters REFUNDED state.
- **EXECUTED** — terminal state reached after RESOLVED_YES. Beneficiary has received funds.
- **REFUNDED** — terminal state reached after RESOLVED_NO. Vault funds are claimable by members individually. Funds are not automatically pushed; each member calls `claim_refund`.
- **VOID** — fixture cancelled or timed out; all vault funds are claimable by members via the same `claim_refund` instruction.

No state may be skipped or reversed. There is no discrete LOCKED state — the kickoff timestamp enforces the boundary implicitly.

> **Rationale (no LOCKED state):** A discrete LOCKED state requires a keeper to send a lock transaction at kickoff. This creates a race condition: members can join in the window between actual kickoff and the keeper's transaction landing. It also introduces a keeper liveness dependency at a time-critical moment. By replacing LOCKED with a timestamp check in the `join` instruction, the cutoff is enforced deterministically on-chain without any external actor or transaction.

### FR-5: Locking

- FR-5.1 — Locking is lazy: there is no discrete lock transaction. The kickoff timestamp stored at creation serves as the cutoff for all membership and deposit operations.
- FR-5.2 — Any instruction that modifies membership or deposits must reject if the current on-chain clock is at or past the kickoff timestamp.
- FR-5.3 — Condition edits are prohibited at any time after commitment creation (not just after kickoff).

> **Rationale:** Eager locking (a keeper sending a `lock` instruction at kickoff) has two failure modes: keeper downtime means the lock never fires, and the window between kickoff and the transaction landing allows race-condition joins. Lazy locking eliminates both by encoding the enforcement rule in the `join` instruction itself using the stored kickoff timestamp. No keeper is needed at kickoff at all — the liveness dependency shifts entirely to the resolution phase, where it already existed.

### FR-6: Resolution

> The following requirements apply fully when `ESCROW_MODE=on-chain`. In `ESCROW_MODE=keeper-custody`, FR-6.1 and FR-6.3 are satisfied by the keeper acting on a publicly verifiable TxLINE proof — see NFR-1.

- FR-6.1 — Resolution must be permissionless — any wallet may trigger it; no designated role required.
- FR-6.2 — Resolution must only be possible after TxLINE confirms the match as finalised.
- FR-6.3 — Resolution must use TxLINE's on-chain cryptographic proof to verify the condition — no off-chain assertion or admin decision.
- FR-6.4 — The resolution outcome (yes or no) must be publicly verifiable on Solana (e.g. via block explorer).

### FR-7: Settlement

Settlement uses a hybrid push/pull model to remain scalable regardless of DAO size.

> **Rationale:** A fully atomic settlement (one transaction pays everyone) hits Solana's per-transaction account limit (~30–50 accounts) for any DAO above ~20 members. A fully pull-based model (beneficiary also claims) weakens the YES path — the charity payout becomes a deferred event rather than the immediate social-feed moment the product is built around. The hybrid preserves the headline moment (beneficiary paid atomically in the resolve tx) while making the refund path independently claimable per member with no keeper involvement.

**YES path (condition met):**
- FR-7.1 — The resolve transaction must release the vault in full to the beneficiary in the same atomic operation. The beneficiary receives funds without any further action required.

**NO path (condition not met):**
- FR-7.2 — The resolve transaction marks the commitment REFUNDED but does not transfer funds. Each member must individually claim their refund via a separate `claim_refund` instruction.
- FR-7.3 — Each member's claimable amount must equal their pro-rata share of the vault, calculated from the deposit amount recorded at join time.
- FR-7.4 — A member's `claim_refund` call must be executable at any time after REFUNDED state is reached, independent of other members claiming.
- FR-7.5 — Unclaimed refunds must remain claimable indefinitely. There is no expiry window. A vault account remains open until all members have claimed. When the final member claims, the vault account is closed and its rent reserve lamports are transferred to that claimant as part of the same instruction.

> **Rationale (FR-7.5):** An expiry window creates deadline anxiety and the possibility of members permanently losing funds due to inattention. The only downside of indefinite claimability is that an unclaimed vault account cannot be closed on-chain until the deposit is withdrawn (Solana requires an account to be empty before reclaiming its rent reserve). This rent accumulation is negligible at hackathon and small-scale production use; the user experience benefit outweighs it.

### FR-8: Cancellation and Void

- FR-8.1 — Void must be permissionless — any wallet may trigger it.
- FR-8.2 — The void instruction must verify fixture cancellation on-chain via the `validateFixture` CPI. An off-chain assertion alone is not sufficient. This is the same standard of proof required for resolution.
- FR-8.3 — Upon void, all vault funds become claimable by members via the same `claim_refund` instruction used in the NO path. Funds are not automatically pushed.
- FR-8.4 — Void must be triggerable while the commitment is in OPEN state (before or after kickoff timestamp, as long as no resolution has occurred).
- FR-8.5 — VOID refunds are claimable indefinitely, consistent with FR-7.5.
- FR-8.6 — If a commitment remains in OPEN state 7 or more days past its stored kickoff timestamp without reaching RESOLVED or VOID, any member may trigger a timeout. The timeout check must be enforced using the on-chain clock against the kickoff timestamp — no external signal required.
- FR-8.7 — A timed-out commitment must enter VOID state, making all vault funds claimable via `claim_refund` on the same terms as a cancelled fixture.

> **Rationale (FR-8.2):** Without on-chain verification, the void path is an attack vector: a member who anticipates a losing outcome could trigger void with a false off-chain claim that the fixture was cancelled, reclaiming their stake before resolution. Requiring `validateFixture` CPI closes this — cancellation must be cryptographically verifiable on-chain, the same bar set for condition resolution via `validateStatV2`.
>
> **Rationale (FR-8.6–8.7):** If TxLINE never emits `game_finalised` — due to an outage, a disputed match, or an indefinite postponement — a commitment sits in OPEN state post-kickoff with funds frozen and no resolution path. A 7-day timeout gives members a guaranteed exit without relying on any external signal. Using the on-chain clock means the timeout is self-contained and requires no oracle input, unlike resolution and void which depend on TxLINE proofs.

### FR-9: Public Board

- FR-9.1 — All commitments must be publicly visible to any visitor without a wallet connection.
- FR-9.2 — Each commitment listing must display: condition (human-readable), beneficiary, total pledged amount, member count, and current status.
- FR-9.3 — The board must be browsable before, during, and after a match.
- FR-9.4 — The board should support filtering and sorting by: pledged amount, condition type, beneficiary, and group size.

### FR-10: Live Settlement Feed

- FR-10.1 — The system must surface resolution events in real time as they occur on-chain.
- FR-10.2 — Each event in the feed must link to the settlement transaction on a Solana block explorer.
- FR-10.3 — The feed must distinguish individual settlements from group (DAO) settlements.

### FR-11: Wallet Sign-In

- FR-11.1 — The frontend must integrate the Solana wallet adapter. Supported wallets at minimum: Phantom, Solflare, Backpack.
- FR-11.2 — A wallet connection is required to perform any write action: creating a commitment, joining a group, withdrawing, claiming a refund, and triggering resolve or void.
- FR-11.3 — Wallet connection must not be required to browse the public board or view commitment details (FR-9.1).
- FR-11.4 — The connected wallet address must be used as the pledger/member identity on-chain. No separate account creation or username is required.
- FR-11.5 — The UI must clearly surface the connected wallet address and provide a disconnect option at all times when a wallet is connected.

### FR-12: Pending Claim Notifications

- FR-12.1 — When a commitment reaches REFUNDED or VOID state, every member with an unclaimed deposit must be notified that they have a pending refund to claim.
- FR-12.2 — The notification must include: the commitment name/fixture and the claimable amount. There is no deadline to communicate — claims are open indefinitely.
- FR-12.3 — When a wallet is connected, the UI must prominently surface any open claims belonging to that wallet across all commitments — regardless of which page the user is on.
- FR-12.4 — Unclaimed refunds must remain visible in the member's claim history until they are collected.
- FR-12.5 — When a commitment resolves YES and funds are released to the beneficiary, the beneficiary must be notified that funds have arrived.
- FR-12.6 — The beneficiary notification must include: the commitment name/fixture, the amount received, and a link to the settlement transaction on a Solana block explorer.

> **Rationale:** The pull-based refund model (FR-7, NO path) requires members to take an explicit action to recover their funds. Unlike a push model where refunds arrive automatically, members who never return to the app would silently lose access to their money without any prompt. Notifications exist solely because the settlement model requires user action — they are a direct consequence of the pull design choice.

### FR-13: Keeper — Off-Chain Automation

- FR-13.1 — The keeper must subscribe to TxLINE's SSE stream (`/api/scores/stream`) as its primary signal for `game_finalised` events.
- FR-13.2 — The keeper must also scan `/api/scores/updates/{epochDay}/{hour}/{interval}` at a regular interval (no greater than 60 seconds) as a fallback, independently of the SSE stream. On each scan, it checks recent intervals for records with `action=game_finalised` on tracked fixtures.
- FR-13.3 — On detecting `game_finalised` via either channel, the keeper must fetch the stat-validation proof and submit the resolve transaction.
- FR-13.4 — The keeper must detect SSE disconnection and log it. Polling must continue uninterrupted regardless of SSE state — the two channels operate in parallel, not in series.
- FR-13.5 — If the keeper submits a resolve transaction that fails because the commitment is already resolved (idempotent state), it must treat this as a success and not retry.

> **Rationale:** Resolution is permissionless (FR-6.1), so a keeper outage does not lock funds — any wallet can resolve manually. However, the YES-path social feed moment (charity payout visible in real time) depends on the keeper firing promptly. The SSE stream is a single point of failure: a dropped connection during extra time leaves the keeper blind to finalisation. Parallel polling ensures `game_finalised` is detected even if the SSE stream is down, without adding complexity to the primary path.

### FR-14: Off-Chain Indexer

- FR-14.1 — The system must maintain an off-chain indexer that listens to on-chain commitment program events and stores commitment state in a queryable database.
- FR-14.2 — The indexer must capture and store for each commitment: fixture, condition (human-readable form), beneficiary address, total pledged amount, member count, and current status.
- FR-14.3 — The indexer must update in real time as on-chain state changes — commitment creation, member joins, withdrawals, resolutions, voids, and timeouts must all be reflected promptly.
- FR-14.4 — The indexer must expose a query interface that supports the filtering and sorting operations required by the public board (FR-9) and the pending claims view (FR-12).
- FR-14.5 — The indexer must not be a trust dependency for fund safety. It is read infrastructure only — no settlement or resolution logic may depend on indexer data. On-chain state is always the source of truth.

> **Rationale:** Solana account data is not queryable like a database. Operations like "all commitments sorted by pledged amount" or "all open claims for wallet X" require iterating every account owned by the program — which is slow, expensive, and not feasible in a page load. The indexer makes the public board and claim notifications possible without compromising the trustless settlement model: it serves reads, the chain handles writes.

### FR-15: In-Play Pledge Card

- FR-15.1 — During a live match, the pledge card must display the current score in real time, updating without a page refresh.
- FR-15.2 — The pledge card must display the live status of the pledger's condition against current match data — expressed in plain language (e.g. "Both teams have scored ✓", "1 of 2 goals needed", "Clean sheet so far").
- FR-15.3 — The pledge card must display a live event log of match events relevant to the condition (e.g. goals, red cards) as they occur, with timestamp and team.
- FR-15.4 — Condition status must have three visible states: **tracking** (still possible, not yet met), **met** (condition is satisfied with play still ongoing), **resolved** (match finalised, outcome confirmed).
- FR-15.5 — Live data must be sourced from TxLINE's score stream. The frontend must not derive condition status from off-chain computation alone — it must reflect what TxLINE reports.

> **Rationale:** Judging criterion #2 explicitly rewards a product that "responds to what's actively unfolding on the pitch." A pledge card that only changes at the final whistle fails this criterion outright — the product reads as a static escrow, not a live experience. The in-play card is what makes the stakes visible and emotionally connected to the match as it happens.

---

## Non-Functional Requirements

| # | Requirement |
|---|---|
| NFR-1 | **Trustless (on-chain path)** — when `ESCROW_MODE=on-chain`, no admin key, multisig, or committee may alter, block, or redirect fund flows at any point. Resolution is driven entirely by the on-chain `validateStatV2` CPI; the keeper cannot override the outcome. When `ESCROW_MODE=keeper-custody`, resolution is automated and proof-gated but keeper-signed — the keeper evaluates the TxLINE proof off-chain and submits the outcome. Both modes must disclose the active path to the pledger at commitment creation time. |
| NFR-2 | **Permissionless resolution** — when `ESCROW_MODE=on-chain`, any wallet may trigger resolution; no designated role is required. When `ESCROW_MODE=keeper-custody`, the keeper is the designated resolver but the resolution condition (TxLINE proof) remains publicly verifiable. In both modes, the resolution path must remain live even if the original pledger is absent or unresponsive. |
| NFR-3 | **Transparency** — all commitments, membership, and settlements are on-chain and publicly inspectable at any time. |
| NFR-4 | **No counter-party** — the protocol must not match pledgers against opposing bets. Beneficiaries are defined at creation, not determined by an opposing party. |
| NFR-5 | **Devnet scope** — all hackathon operations use Solana devnet and devnet SOL. Mainnet deployment is out of scope. |
| NFR-6 | **Backend-agnostic escrow interface** — the frontend must interact with a single `ESCROW_MODE` interface that abstracts the underlying settlement path. The active path (on-chain Anchor program or keeper-custody) must be switchable without frontend changes. |

---

## External Dependencies

The following TxLINE capabilities are required by this protocol:

| Capability | Purpose |
|---|---|
| `/api/fixtures/snapshot` | Fixture universe, kickoff times, cancellation detection |
| `/api/scores/stream` (SSE) | `game_finalised` event — triggers resolution window |
| `/api/scores/stat-validation` | Merkle proof package for on-chain condition verification |
| `validateStatV2` (on-chain CPI) | Trustless condition evaluation against Merkle proof |
| `validateFixture` (on-chain CPI) | Fixture cancellation detection for void path |

---

## Open Questions

All open questions resolved.

| # | Question | Resolution |
|---|---|---|
| OQ-1 | Which TxLINE stat keys correspond to match outcome (win/loss/draw), and do they account for extra time and penalty shootouts? | **Resolved.** Stat keys 1/2 = P1/P2 total goals, ET goals included, penalty shootout goals excluded (shootout goals are separate keys 6001/6002). "Team wins" ships as keys `[1,2]`, Subtract, GreaterThan 0. A draw settled by shootout does not satisfy this condition — disclosed in UI at selection. |

---

## Out of Scope

- Counter-party wagering of any kind (sportsbook, peer-to-peer bets, prediction markets)
- Private or anonymous commitments
- Formal DAO token voting, quorum mechanics, or governance beyond join-as-commit
- Conditions referencing data sources other than TxLINE
- Mainnet deployment or real-money usage
- Resolver incentive or protocol fee mechanism — the keeper covers resolution for the hackathon; a fee model is a future consideration
