# Idea 01 — Review: Hidden Assumptions, Weak Areas, and Improvements

This is a critical review of `idea-01.md` and `req-01.md`. Findings are grouped by area and labeled **[Critical]**, **[Significant]**, or **[Minor]** based on their potential to break the product.

---

## 1. Protocol / On-Chain Weaknesses

### 1.1 Locking is never actually automatic [Critical]

FR-5.1 requires a commitment to "lock at kickoff without requiring manual action." On Solana, nothing happens without a transaction. Someone must send a lock transaction. The idea document acknowledges this with "(auto or manual)" but never resolves it.

**The gap:** If locking depends on a keeper sending a transaction, the keeper is a liveness dependency — not just for resolution but for the integrity of membership cutoff. A keeper that's down at kickoff means members can still join mid-match. Lazy locking (enforced at resolve time by checking whether each deposit predates kickoff) is more robust but has different trade-offs.

**Improvement:** Decide explicitly between eager locking (keeper sends a lock tx at kickoff) and lazy locking (the contract validates deposit timestamps at resolve time). Lazy locking eliminates the keeper-at-kickoff problem but requires reliable timestamps on-chain.

---

### 1.2 FR-7.4 Atomicity is technically unimplementable at scale [Critical]

FR-7.4: "Settlement must execute atomically — partial releases are not permitted."

On Solana, a single transaction can reference at most ~30–50 accounts and has a compute unit cap. If a DAO has 100 members and the condition fails, you cannot refund all members in one transaction.

**The gap:** A large DAO hitting the NO path would require either batched transactions or a pull-based claim model. Neither is covered by the requirements. As written, FR-7.4 is unimplementable for any DAO beyond ~20 members.

**Improvement:** Replace atomic settlement with a two-phase model:
1. `resolve` marks the commitment RESOLVED_YES or RESOLVED_NO.
2. In the YES path, the beneficiary claims (one account — one tx — achievable).
3. In the NO path, each member calls `claim_refund` individually (pull model, avoids compute blowout).

This also eliminates the need to track all members in the resolution transaction.

---

### 1.3 No maximum DAO size [Critical]

Related to 1.2. The `members: Vec<Pubkey>` grows unboundedly. At ~32 bytes per pubkey, a DAO with 1,000 members exceeds Solana's 10 MB account size limit at around 312,500 members — but compute limits and indexing will fail far sooner.

**The gap:** No cap is stated anywhere. For a hackathon demo this doesn't matter, but the architecture implies a cap must exist.

**Improvement:** Define a maximum member count (e.g., 200) at the protocol level. Enforce it at the `join` instruction. State this explicitly in requirements.

---

### 1.4 Void path has no on-chain verification requirement [Significant]

FR-8.1 says void is triggered "as signalled by TxLINE" but doesn't specify that this must be verified on-chain via `validateFixture`. The idea doc lists `validateFixture` CPI under TxLINE primitives, but the requirement doesn't mandate it.

**The gap:** If void can be triggered by anyone claiming off-chain that a fixture was cancelled, this is an attack vector. A pledger who expects to lose could attempt to void the commitment to reclaim their stake.

**Improvement:** FR-8 should explicitly require that the VOID transition uses `validateFixture` CPI to verify cancellation on-chain — same standard of proof as resolution.

---

### 1.5 The keeper is a hidden centralization point [Significant]

The idea emphasizes "permissionless" resolution, but the realistic UX path is:
- Keeper listens to TxLINE SSE → `game_finalised` → fetches proof → posts resolve tx.

Without the keeper, resolution is "possible" but won't happen automatically. The SSE stream is a single point of failure: a dropped connection during extra time leaves the keeper blind to finalisation.

**The gap:** No fallback for SSE disconnection. No requirement for the keeper to reconnect or poll as a backup. If the keeper is down when `game_finalised` fires, members have to manually trigger resolution — and they might not know how.

**Improvement:** Require a polling fallback: if the keeper misses the SSE event, it should also poll `/api/fixtures/snapshot` at a defined interval to detect `game_finalised`. Make this explicit in the architecture even if it's not a user-facing requirement.

---

### 1.6 No stuck-state recovery [Significant]

If TxLINE never emits `game_finalised` (outage, bug, or a match that's in dispute), the commitment sits in LOCKED state with funds frozen and no exit path.

**The gap:** There is no timeout requirement. A match that's disputed for three weeks would leave all commitments locked indefinitely.

**Improvement:** Add a timeout requirement: if a commitment remains LOCKED for N days past the scheduled fixture date without reaching RESOLVED or VOID, it should be voidable by members. This is a safety valve, not the primary path.

---

### 1.7 Double-resolution is unaddressed [Minor]

If two wallets both call resolve within the same Solana slot, the second call must fail gracefully. The state machine implies this but it's never stated as a requirement.

**Improvement:** Add an explicit idempotency requirement: once a commitment reaches RESOLVED_YES, RESOLVED_NO, EXECUTED, REFUNDED, or VOID, any further resolve/void calls must fail without side effects.

---

## 2. Product / UX Gaps

### 2.1 Pre-kickoff withdrawal is never addressed [Critical]

"Join = co-sign" is the stated design. But this means if a member deposits $500 into a DAO and changes their mind two hours before kickoff, they have no exit.

**The gap:** This is never explicitly stated as prohibited, nor addressed as a feature. In practice, most users will expect to be able to change their mind before the game starts. The current design silently traps their funds until resolution.

**Improvement:** Make the decision explicit. Either:
- Allow withdrawal from OPEN group commitments before kickoff (weakens the "commitment" framing but improves UX)
- Explicitly state that deposits are irrevocable from the moment of joining (simple, but must be surfaced clearly in the UI — "this is your commitment, not a deposit")

---

### 2.2 Beneficiary is unaware, unconsenting, and unverified [Significant]

The beneficiary is just a wallet address. They:
- Don't know a commitment exists targeting them
- Don't consent to receiving funds
- Can't reject (e.g., a charity with a policy against accepting crypto)
- Have no recourse if the address is wrong or stale

**The gap:** Funds could be sent to a dormant address, an exchange hot wallet that can't receive USDC, or a program that doesn't support token transfers. There's no requirement to verify the beneficiary is a valid recipient.

**Improvement:** At minimum, require the UI to warn pledgers that beneficiary addresses are unverified and irrevocable. Consider a registry of known beneficiaries (off-chain whitelist) for the hackathon demo to demonstrate the social trust layer without implying arbitrary addresses are safe.

---

### 2.3 Odds probability display breaks for compound conditions [Significant]

FR-11 requires displaying implied probability sourced from TxLINE odds. TxLINE provides odds for standard markets. A compound condition like "no red cards AND corners > 8 AND both teams score" doesn't correspond to any standard market.

**The gap:** Computing a joint probability requires multiplying individual probabilities — which assumes independence. Football stats are correlated (high-corner games tend to be more open, which affects red card likelihood). Showing a computed probability could actively mislead users.

**Improvement:** Either scope the probability display to conditions that map cleanly to a single standard market (e.g., home win, over/under), or clearly label compound probability estimates as approximate. Multi-stat conditions without a corresponding market should show no probability rather than a misleading one.

---

### 2.4 Public board requires an off-chain indexer [Significant]

FR-9.4 requires filtering and sorting by amount, condition type, beneficiary, and group size. Solana on-chain accounts aren't queryable in this way — there's no built-in "get all PDAs with field X" operation.

**The gap:** The requirements imply a queryable board backed by a database, but no indexer is mentioned anywhere. Without one (Helius webhooks, The Graph, or a custom event log), the board either can't exist or must be built with a full on-chain account scan on every page load — which is slow and expensive.

**Improvement:** Add an explicit requirement for an off-chain indexer that listens to commitment program events and maintains a queryable database. This is infrastructure, not UI, and needs to be planned.

---

### 2.5 Resolver has no incentive [Minor]

The Resolver actor pays transaction fees to resolve a commitment but receives nothing. In the YES case (condition met), the beneficiary profits. In the NO case, members get their refunds. The resolver is subsidizing everyone else's settlement.

**The gap:** For a hackathon demo with a keeper bot, this is fine. At scale, relying on altruistic resolvers is fragile. No mechanism exists to compensate resolvers.

**Improvement:** Consider reserving a small protocol fee (e.g., 0.1% of vault) at commitment creation, paid to the Resolver at settlement. This is optional for the hackathon but worth noting as a future consideration.

---

## 3. Social / Game Theory Weaknesses

### 3.1 Incentive to resolve is asymmetric [Significant]

When condition is NOT MET: members want refunds → strong organic incentive to hit "Resolve."

When condition IS MET: the pledger's funds are gone either way (they already committed them); the beneficiary might not know the commitment exists. The random public has no financial incentive to resolve.

**The result:** YES resolutions (charity gets paid) are slower than NO resolutions (refunds happen quickly). This is backwards from the social narrative — the headline moment ("$12,000 released to charity!") depends on someone taking action with no personal reward.

**Improvement:** The keeper must be responsible for triggering resolve in both YES and NO cases. The social feed's value depends on timely YES resolutions. Don't rely on organic pressure for the YES path.

---

### 3.2 Member count as social signal is gameable [Minor]

The public board highlights member count as a social proof signal ("38 members!"). One entity can create many wallets and join with dust deposits to inflate member count with minimal cost.

**The gap:** There's no minimum deposit requirement, no sybil resistance, and the member count is shown prominently.

**Improvement:** Display total pledged value prominently alongside member count. Total pledged value is harder to spoof cheaply (it requires real capital). Consider a minimum deposit threshold to join a DAO (e.g., $1 USDC) to raise the cost of sybil inflation.

---

## 4. Condition Language Gaps

### 4.1 Ambiguous match outcomes [Significant]

"Brazil wins" — does this include extra time? Penalty shootouts? What stat key does TxLINE use for "match winner"? In knockout rounds, a 1–1 draw that goes to penalties produces a winner that doesn't appear in the 90-minute goals stat.

**The gap:** The condition examples in the idea doc are all stat-count based (goals > 2, red cards = 0). None address match outcome (win/loss/draw) directly. This is the most common thing fans want to pledge on.

**Improvement:** Clarify which TxLINE stat keys correspond to match outcome (including extra time and penalties). If TxLINE doesn't provide a clean "match winner" stat key, the condition templates must not expose "X wins" as an option — or must clearly define what "wins" means (90 minutes only?).

---

### 4.2 Abandoned matches during play [Minor]

The VOID path covers fixture cancellation before the match (`GameState=6`). But what about a match that starts and is then abandoned mid-game (crowd trouble, severe weather at 75')? This is different from pre-match cancellation.

**The gap:** The requirements have no state for "started but abandoned." Such a match might or might not reach GameState=6 in TxLINE. A LOCKED commitment with no resolution path and no void trigger would be stuck.

**Improvement:** Confirm with TxLINE documentation whether abandoned matches eventually reach GameState=6. If so, the existing void path covers it. If not, a separate abandoned-match path is needed.

---

## 5. Summary of Priority Fixes

| # | Finding | Impact | Fix Complexity |
|---|---|---|---|
| 1.1 | Locking mechanism is unspecified | Membership integrity | Medium |
| 1.2 | Atomic settlement unimplementable at scale | Protocol correctness | Medium |
| 1.3 | No DAO size cap | Protocol correctness | Low |
| 1.4 | Void lacks on-chain verification | Security | Low |
| 1.5 | Keeper has no SSE fallback | Liveness | Low |
| 1.6 | No stuck-state recovery | Fund safety | Medium |
| 2.1 | Pre-kickoff withdrawal not addressed | UX / adoption | Medium |
| 2.2 | Beneficiary unverified and unaware | Trust / usability | Low |
| 2.3 | Compound condition probability misleading | Trust | Low |
| 2.4 | Public board needs an indexer | Infrastructure | High |
| 3.1 | YES resolution has no organic incentive | Social layer reliability | Low |
| 4.1 | "Team wins" condition is ambiguous | Correctness | Low |
