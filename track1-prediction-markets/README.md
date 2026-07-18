# LEGATO — Multi-Leg Proof Markets

> **Track sentence (verbatim):** "The flagship track. Markets, resolution and settlement built on verifiable World Cup data: outcome markets, oracle tooling, on-chain proof integrations."
>
> **Prize:** $18,000 USDT (12k / 4k / 2k) · Prediction Markets and Settlement · TxODDS × Superteam

**Tagline:** Bet the story of the match — settle every leg in a single Merkle proof.

## One-line pitch

LEGATO turns World Cup narratives into multi-leg prediction markets that resolve via one on-chain `validateStatV2` CPI against TxLINE Merkle roots — not admin keys, not single-stat YES/NO clones.

## Product vision

Most Track 1 submissions are **binary markets + `validate_stat`**. LEGATO is different: the product *is* the multi-stat strategy. Fans (and operators) compose a **story ticket** — e.g. "home wins AND both teams score AND under 4.5 goals" — pinned on-chain as a `validateStatV2` strategy. At full-time (`action=game_finalised`, `statusId=100`), anyone submits one proof package; the program CPI-verifies **all legs together**; escrow pays or voids. Odds from TxLINE StablePrice power fair opening prices so the board feels alive before kickoff.

**Wow moment (10 seconds):** Judge watches a seeded multi-leg ticket resolve. Explorer shows a single settlement tx with CPI into `txoracle::validateStatV2`. UI stamps each leg PROVED and releases the claim. No admin button.

## Why this wins

| Rubric pressure | How LEGATO answers |
|---|---|
| Markets | Story props, period markets (H1/H2), not another 1X2 picker |
| Resolution | Permissionless `resolve` with real TxLINE proofs |
| Settlement | Solana escrow + parimutuel (devnet USDC/SOL) |
| Oracle tooling | Predicate → V2 strategy compiler, proof inspector, fixture void path |
| On-chain proof integrations | **`validateStatV2` first** (competitors mostly stop at `validateStat`) |
| Demo-video heavy judging | Instant-settle historical fixture loop always works offline of live matches |
| Differentiation | Crowded field of ProofBall / KickTick / Whistle / pari-market clones |

## Competitive map (skimmed Jul 18 2026)

| Project | Shape | Gap LEGATO fills |
|---|---|---|
| **ProofBall** | Binary props + `validate_stat` CPI + proof receipts | Single-stat only; no multi-leg V2 story tickets |
| **KickTick** | Sub-minute micro YES/NO on events | Time-boxed micro-rounds, not narrative FT settlement |
| **Whistle** | 1X2 + O/U pools, squads, admin settle | Admin/ops resolution; weaker trustless proof story |
| **worldcup-pari-market** | Simple YES/NO USDC + `validate_stat` | Minimal market types; no odds backbone |

## SUPA / Track-2 boundary

This directory is a **separate Track 1 project**. Do **not** merge it into Track 2 (Consumer/Fan) or Track 3 (Trading Tools & Agents in `hackathon-template/`).

| Shared (allowed) | Forbidden |
|---|---|
| TxLINE credentials pattern (`~/.secrets/txline-devnet-creds.json` or `.env` refs) | Same deployed app / same Superteam submission |
| Reusable `txline-client` helpers (auth headers, SSE parse) | Same on-chain program / same market UX |
| Docs lessons / PREFLIGHT friction logs | Claiming one codebase for two tracks |

If a Track 2 or Track 3 build needs data, it consumes **TxLINE (or a thin shared API client)** — not LEGATO's market/settlement API as its product surface.

## Deadline pressure

| Cut | Time |
|---|---|
| **London IRL hard deadline** | **Sun? Sat Jul 19 2026 12:00 BST** (organizer: submit by ~11:30) |
| Global close | Jul 19 2026 23:59 UTC |
| Free TxLINE premium window ends | Jul 19 2026 23:59 UTC |

Ship the **MVP golden path** in `PLAN.md` §3 first. Everything else lives in the addon catalog / `BACKLOG.md`.

## Docs in this folder

| File | Purpose |
|---|---|
| [`PLAN.md`](./PLAN.md) | Architecture, MVP, full addon catalog, endpoints, settlement, timeline, demo shot list |
| [`BACKLOG.md`](./BACKLOG.md) | Post-MVP features with displacement tests |
| [`PREFLIGHT.md`](./PREFLIGHT.md) | TxLINE / Solana spike checklist (no secrets) |
| [`docs/specs/01-APP-OVERVIEW.md`](./docs/specs/01-APP-OVERVIEW.md) | Wave-1 overview skeleton |

## Env pattern (no secrets in repo)

```bash
# .env.example — copy locally; never commit real tokens
TXLINE_NETWORK=devnet
TXLINE_API_ORIGIN=https://txline-dev.txodds.com
SOLANA_RPC_URL=https://api.devnet.solana.com
# Prefer loading JWT + X-Api-Token from ~/.secrets/txline-devnet-creds.json
# (produced by ../txline-setup/setup.mjs)
```
