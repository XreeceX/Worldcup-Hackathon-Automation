# 01-APP-OVERVIEW.md — LEGATO

> **Track sentence (verbatim):** The flagship track. Markets, resolution and settlement built on verifiable World Cup data: outcome markets, oracle tooling, on-chain proof integrations.
>
> **Persona (real):** London hackathon builder / small prediction-ops desk who needs exotic multi-condition props without an oracle committee — and a Solana explorer link that proves payout.
>
> **Wow moment:** One settlement transaction CPI-calls `validateStatV2`; UI stamps every leg PROVED; winner claims from escrow.

## 1. Product summary

LEGATO is a Solana prediction-market desk for World Cup **story tickets**: multi-leg YES/NO markets whose resolution condition is a TxLINE `validateStatV2` strategy over Merkle-proven match stats. TxLINE fixtures/odds/scores power the board; proofs settle the escrow. No admin resolve key.

**Tagline:** Bet the story of the match — settle every leg in a single Merkle proof.

## 2. Problem (numbers table)

| Item | Value | Note |
|---|---|---|
| Track prize | $18k USDT | Flagship track |
| Typical competitor shape | Binary + `validate_stat` | Crowded |
| LEGATO wedge | Multi-leg + `validateStatV2` | Sparse in field |
| Demo risk | Live matches may be quiet | Historical settle loop required |

## 3. Golden path (step table)

| Op | Amount / artifact | Purpose |
|---|---|---|
| create_market | pinned `statKeys` + strategy | List story market |
| stake YES/NO | e.g. 10 USDC | Fund parimutuel side |
| fetch proof | `/scores/stat-validation?statKeys=` | Build CPI args |
| resolve | CPI `validateStatV2` | Trustless outcome |
| claim | pro-rata pool share | Settlement complete |

## 4. Primary user journey (narrated)

**Context:** Operator wants "home wins AND both teams score" for an archived friendly.

1. **Sees** strategy compiler with leg chips → **Does** pick Win + BTTS template → **Gets** market PDA preview with immutable strategy JSON.
2. **Sees** OPEN market on board → **Does** stake YES from faucet wallet → **Gets** position + pool %.
3. **Sees** Settle demo CTA → **Does** click resolve → **Gets** explorer link; legs PROVED; claimable balance.
4. **Emotional payoff:** Trustless multi-leg settle without admin — the wow.

## 5. Use cases

| Type | Actor | Trigger | Success | Rubric axis |
|---|---|---|---|---|
| Primary | Fan | Wants story bet | Claim after V2 resolve | Markets / settlement |
| Primary | Anyone | FT proof ready | Permissionless resolve | Resolution / proofs |
| Primary | Operator | Lists template | Market opens with pinned strategy | Oracle tooling |
| Secondary | Operator | Fixture cancelled | Void + refund | Oracle tooling |
| Secondary | Fan | Pre-match | Sees StablePrice-implied open | Markets (P1) |

## 6. Architecture (text)

`Web board` ↔ `LEGATO API/Keeper` ↔ `TxLINE REST/SSE`  
`Web wallet` → `legato program` —CPI→ `txoracle.validateStatV2` ← Merkle roots PDA

## 7. Design principles

1. **Proof or no pay** — never admin-resolve YES/NO.
2. **Strategy pinned at create** — resolver cannot change the question.
3. **Observed seq only** — no synthetic sequences.
4. **Devnet first** — real CPI on explorer beats polished mocks.
5. **Track boundary** — separate from Track 2/3; shared TxLINE client only.
