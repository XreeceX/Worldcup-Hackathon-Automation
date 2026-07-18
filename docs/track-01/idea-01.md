# Idea 01 — Social Commitment Engine

## One-line pitch

A protocol where fans, brands, and public figures lock conditional vows on-chain before a match — and the World Cup result auto-executes them, trustlessly, with no way to back out.

---

## Core insight

The deepest human thing about sport is that it makes people promise things. These promises are everywhere — social media, group chats, locker rooms — and almost none are kept, because there's no enforcement layer.

TxLINE changes that. The World Cup result is now a trustless, cryptographically verifiable fact on Solana. A smart contract can read the match outcome as truth and execute a consequence automatically. No admin. No committee. No "well technically the rules said..."

This is not betting. It is a **conditional social contract protocol** where sport is the enforcement mechanism.

---

## What it is

Anyone can lock a conditional commitment before a match:

- A fan pledges USDC to a charity if their team wins
- A brand commits to unlocking a product drop if a specific player scores
- A public figure commits to a verifiable on-chain action if an upset happens
- A community funds a local football academy if their national team advances

The commitment is locked in a Solana escrow PDA before kickoff. When the match ends, TxLINE's `validateStatV2` proof trustlessly confirms whether the condition was met. The escrow auto-executes — funds release to the charity wallet, the product drop fires, the action lands.

No one can back out. No one needs to trust anyone. The sport is the oracle.

---

## Why this is not betting

| Betting | Commitment |
|---|---|
| Two parties take opposite financial sides | Only the pledger puts something at stake |
| Counter-party profits from your loss | Beneficiary (charity, community) is defined upfront |
| Zero-sum outcome | No counter-party taking the other side |
| You hedge against your own desire | You want the condition to be true |

Structurally closer to a conditional donation or a charitable escrow than a sportsbook. The pledger is not trying to profit — they are making a vow with financial weight.

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

A simple UI lets pledgers compose conditions from human-readable templates. The strategy compiles to a `validateStatV2` payload stored on-chain with the escrow. The condition is immutable once the match starts.

---

## The social layer

Commitments are public by design. Before the match, anyone can browse what people have pledged — sorted by size, by cause, by condition. During the match, the stakes are visible. After the final whistle, auto-executions land on-chain in real-time.

A live feed shows: *"$12,000 just released to 14 charities as France scored."* Settlement is not a backend event — it's a public, verifiable moment that spectators can watch happen.

---

## Technical architecture

```
Pledger composes condition (UI template → validateStatV2 strategy)
  └── locks USDC + strategy + beneficiary in escrow PDA (pre-kickoff)
        └── match ends → keeper detects game_finalised via SSE
              └── fetches stat-validation proof package from TxLINE
                    └── submits resolve tx:
                          CPI validateStatV2 → condition true/false
                            └── true  → release to beneficiary wallet
                                false → refund to pledger
```

**On-chain state:**
- `commitment` PDA — fixture_id, strategy blob, escrow vault, beneficiary, pledger, status
- State machine: `OPEN → LOCKED (kickoff) → RESOLVED | REFUNDED`
- Void path: fixture cancelled (`GameState=6`) → full refund

**TxLINE primitives used:**
- `/api/fixtures/snapshot` — fixture universe + cancel detection
- `/api/scores/stream` SSE — game_finalised trigger for keeper
- `/api/scores/stat-validation` — Merkle proof package
- `/api/odds/snapshot/{fixtureId}` — display implied probability of condition at creation time
- `validateStatV2` CPI — trustless condition verification on-chain

---

## Demo flow

1. Pledger opens app, selects upcoming match
2. Composes condition from template ("home team wins AND both teams score")
3. Sets amount and beneficiary wallet (charity address)
4. Signs — commitment locked on-chain; board shows live pledges for this match
5. Match ends — keeper detects `game_finalised` via TxLINE SSE
6. Anyone hits "Resolve" — CPI fires `validateStatV2`
7. Condition met → funds auto-release to beneficiary; explorer link shown
8. Live feed updates: commitment resolved, beneficiary received funds

---

## The almost impossible part

The condition language has to be expressive enough to capture real human promises but constrained enough to map cleanly to `validateStatV2` predicates. The UI has to make that feel like writing a sentence, not programming a contract. The social feed has to make executions feel meaningful — not just a transaction log. And the keeper must handle simultaneous match finales across a 104-game tournament without missing a settlement window.

---

## What's not in scope

- Counter-party wagering of any kind (no opposing bets)
- Anonymous or private commitments
- Conditions referencing non-TxLINE data (weather, player markets, etc.)
- Mainnet real-money deployment for hackathon (devnet USDC demo)
