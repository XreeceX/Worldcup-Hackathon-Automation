# Idea 01 — Social Commitment Engine (Individual + Fan DAO)

## One-line pitch

A protocol where fans and communities lock conditional vows on-chain before a match — individually or as a collective DAO — auto-executed by TxLINE's Merkle proof when the final whistle blows.

---

## Core insight

The deepest human thing about sport is that it makes people promise things. These promises are everywhere — social media, group chats, locker rooms — and almost none are kept, because there's no enforcement layer.

TxLINE changes that. The World Cup result is now a trustless, cryptographically verifiable fact on Solana. A smart contract can read the match outcome as truth and execute a consequence automatically. No admin. No committee. No "well technically the rules said..."

This is not betting. It is a **conditional social contract protocol** where sport is the enforcement mechanism — available to individuals and collectives alike.

---

## Two modes, one primitive

Individual pledges and group DAOs are the **same on-chain primitive at different scale**. An individual commitment is a group of one.

### Individual mode

A single fan locks a conditional pledge before a match:
- A fan pledges USDC to a charity if their team wins
- A brand commits to unlocking a product drop if a specific player scores
- A public figure commits to a verifiable on-chain action if an upset happens

### Group / Fan DAO mode

A collective governs a shared treasury around a team or match:
- "Brazil DAO" — fans pool funds; if Brazil wins the group stage, the treasury funds a youth football academy in São Paulo
- Any fan can join by depositing before kickoff — **joining is co-signing**
- No formal voting mechanism needed: membership IS the commitment
- When the condition resolves, the entire pooled treasury executes atomically

Both modes share the same condition language, the same TxLINE proof flow, and the same resolution engine. The only difference is `members.length`.

---

## The unified `Commitment` account

```
Commitment {
  fixture_id:  u64
  strategy:    NDimensionalStrategy   // validateStatV2 payload
  beneficiary: Pubkey                 // charity, cause, wallet
  members:     Vec<Pubkey>            // length 1 = individual, length N = DAO
  vault:       Pubkey                 // escrow PDA holding pooled funds
  status:      Draft | Open | Locked | Resolved | Void
}
```

| Instruction | Individual | Group |
|---|---|---|
| `create` | Pledger sets condition + beneficiary | Founder sets condition + beneficiary |
| `join` | N/A | Anyone deposits before kickoff |
| `lock` | At kickoff (auto or manual) | At kickoff — no new members after |
| `resolve` | Permissionless after `game_finalised` | Same |
| `claim` / `release` | Funds to beneficiary or refund | Pro-rata refund or full release to beneficiary |
| `void` | Fixture cancelled (`GameState=6`) | Same |

State machine: `OPEN → LOCKED → RESOLVED_YES | RESOLVED_NO → EXECUTED | REFUNDED`

---

## Why this is not betting

| Betting | Commitment |
|---|---|
| Two parties take opposite financial sides | Only pledger(s) put something at stake |
| Counter-party profits from your loss | Beneficiary is defined upfront |
| Zero-sum outcome | No counter-party on the other side |
| You hedge against your own desire | You want the condition to be true |

Structurally closer to a conditional donation or a charitable escrow than a sportsbook.

---

## The condition language

Because TxLINE's `validateStatV2` supports multi-stat strategies, conditions can be expressive:

| Human pledge | Stat strategy |
|---|---|
| "Brazil scores more than 2 goals" | `statKey 1 > 2` |
| "Both teams score AND under 5 total goals" | multi-leg V2: goals each > 0 AND total ≤ 4 |
| "No red cards in the match" | `statKey 5 + statKey 6 = 0` |
| "Clean sheet across both halves" | H1 + H2 period keys (1001/1002) |
| "Home team wins AND corners > 8" | multi-leg V2 across goals + corners |

A simple UI lets pledgers compose conditions from human-readable templates. The strategy compiles to a `validateStatV2` payload stored on-chain at creation. The condition is immutable once the match starts.

---

## The social layer

All commitments — individual and group — are public. Before the match, anyone can browse what's been pledged: sorted by size, by cause, by condition, by group. During the match, the stakes are visible on the board. After the final whistle, auto-executions land on-chain in real-time.

A live feed shows: *"$12,000 just released to 14 charities as France scored — including the Brazil DAO (38 members)."* Settlement is a public, verifiable moment that spectators can watch happen.

---

## Technical architecture

```
Individual / Founder composes condition (UI template → validateStatV2 strategy)
  └── creates Commitment PDA (strategy + beneficiary + vault)
        └── [Group] members join via deposit instruction before kickoff
              └── kickoff → commitment locked (no new members / edits)
                    └── match ends → keeper detects game_finalised via SSE
                          └── fetches stat-validation proof from TxLINE
                                └── permissionless resolve tx:
                                      CPI validateStatV2 → true | false
                                        └── true  → release vault to beneficiary
                                            false → pro-rata refund to members
```

**TxLINE primitives used:**
- `/api/fixtures/snapshot` — fixture universe + cancel detection
- `/api/scores/stream` SSE — `game_finalised` trigger for keeper
- `/api/scores/stat-validation` — Merkle proof package for `validateStatV2`
- `/api/odds/snapshot/{fixtureId}` — display implied probability of condition at creation time
- `validateStatV2` CPI — trustless condition verification on-chain
- `validateFixture` — fixture cancellation / void path

---

## Demo flow

**Act 1 — Individual pledge**
1. Fan opens app, selects an upcoming match
2. Composes condition: "Argentina wins AND both teams score"
3. Sets $50 USDC and beneficiary (charity wallet)
4. Signs — commitment locked on-chain; appears on public board

**Act 2 — Group / Fan DAO**
5. Founder creates "Argentina DAO" with same condition, beneficiary = youth football fund
6. 12 members join by depositing — pooled treasury builds to $800 USDC
7. Kickoff — DAO locks, no new members accepted

**Act 3 — Resolution**
8. Match ends — keeper fires `game_finalised` from TxLINE SSE
9. Anyone hits "Resolve" — CPI fires `validateStatV2`
10. Condition met → individual $50 releases + DAO $800 releases simultaneously
11. Live feed updates; Solana explorer links show both settlement txs with Merkle proof

---

## Track positioning

**Track 1** — the settlement infrastructure is the product:
- On-chain escrow + `validateStatV2` CPI + keeper = oracle tooling
- Group / DAO mode adds collective treasury + permissionless membership
- Every resolution produces a verifiable Solana explorer link
- No admin keys anywhere in the resolution path

**Track 2** — the consumer experience sits on top:
- Individual pledges are accessible to any fan
- Group DAOs build community around teams
- Public board + live feed makes settlement a social event

The infrastructure qualifies for Track 1. The UX qualifies for Track 2. These are separate submissions if competing in both tracks.

---

## Build order (24-hour plan)

1. Individual `create` + `resolve` + `claim` — core loop, minimal on-chain surface
2. Keeper: SSE listener → `game_finalised` → stat-validation fetch → resolve tx
3. Frontend: create flow, public board, resolve button, explorer link
4. Group: add `join` instruction and members array — additive, same resolve path
5. Demo with seeded historical fixture so video doesn't depend on live match

**Kill clock:** If group DAO not green by hour 16, ship individual mode only. The individual flow still demonstrates the full TxLINE proof pipeline and is a complete product.

---

## What's not in scope

- Counter-party wagering of any kind
- Anonymous or private commitments
- Formal DAO token voting or quorum mechanics (join = vote)
- Conditions referencing non-TxLINE data
- Mainnet real-money deployment (devnet USDC for hackathon)
