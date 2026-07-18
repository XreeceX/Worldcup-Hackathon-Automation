# MASTERPLAN — Social Commitment Engine (synthesis of sol critique + competitor scan + hook stats)

Lead synthesis, 2026-07-18 17:15 BST. Sources: `sol-critique.md` (GPT-5.6 sol, read real repo), `competitor-scan.md`, `hook-stats.md`. Pending: Fable 5 validator verdict (appended below when done).

## Consensus score: 43/100 today

Originality 17/20 (strong), Completeness 4/20 (product 0%). Path to winning = completeness + real-time visibility + video quality, not more features.

## STRATEGY CHANGES (from evidence, supersede prior decisions)

1. **Track 1 secondary submission KILLED.** Kickoff rule (RUBRIC.md:29): same project in two tracks disallowed. Track 2 only. Frees ~2h.
2. **Anchor program: 30-min smoke test then decide.** Toolchain now installed (solana 3.1.10, anchor 1.1.2, verified 17:14 BST). If `create`+`resolve` don't compile in 30 min → backend-keeper custody, stated honestly.
3. **Deploy needs backend host** (keeper + TxLINE credentials can't live in static frontend). Decide at spec lock; deploy skeleton by 23:00 BST.

## KILL LIST (locked at spec lock)

DAO/group mode · custom condition language (1-3 fixed templates max) · USDC (devnet SOL only — wallet funded) · odds/implied-probability display · social discovery surface (one pledge card + one settlement feed) · lifecycle machinery (states: pending / condition met / transferred / failed only) · Track 1 video+doc.

## TOP-3 UPGRADES (rubric-ROI order)

1. **One complete individual pledge loop** (6-7h): fixture → fixed condition → beneficiary → devnet SOL → wallet sign → TxLINE resolution → transfer → explorer link.
2. **In-play events visibly change the product** (2-3h): live score + condition-progress card + TxLINE event log; labeled replay of captured real payloads for video; `game_finalised` triggers the real transfer. Final-whistle-only = fails Real-Time criterion.
3. **Video path built + recorded early** (3-4h): rough complete take by 05:00 BST, freeze 07:00, submit by 09:00-11:30.

## PITCH ANGLE

Open on FIFA's own numbers: **1.7B social engagements, video views up 485% vs 2022** (FIFA primary source, hook-stats.md #1) — fans already engage at unprecedented scale; none of it means anything. Then one fan: "If Argentina wins, I send 0.1 SOL to this youth-football wallet." Connect Solana, commit in <30s. Live TxLINE event changes the card on screen; whistle → transfer fires → explorer link. Memory line: **"When the result becomes true, the promise becomes a transaction."** Monetization: small settlement fee on completed pledges — "under 1%, comparable to Polymarket's sports taker fee" (validator: 0.75% flat is UNSUPPORTED; GoFundMe 2.9% needs sourcing before any slide) + brand-sponsored pledge cards. Differentiation (judge Q&A): **"WinGive's mission, BetDEX's trust model, neither one's product"** (competitor-scan.md).

## PLAN RISKS (sol's attack, accepted)

- Skeleton phase must start with the Anchor smoke test, not end with it.
- In-play visibility is a REQUIREMENT by midnight, not polish.
- Rough full video take by 05:00 BST; deployment decided at spec lock, skeleton deployed by 23:00.

## Unknowns ledger

- In-track competitor list not fully visible (only GoalLine confirmed via listing comments).
- Local £5k pool Google form still not in hand — HUMAN ACTION: grab QR at venue.
- Anchor smoke test verdict pending.
- Common Goal 90/10 split + "6B engagement" figure — DO NOT USE (unverified).

## ✅ Fable 5 validation verdict (fresh context, 2026-07-18)

Method: independent re-derivation — ran commands, fetched primary sources, spot-checked file:line citations. Default verdict without proof is UNSUPPORTED.

| Claim | Verdict | Evidence |
|---|---|---|
| Same project in two tracks disallowed (cited RUBRIC.md:28) | **SUPPORTED** (line number off by one) | Rule is real but at RUBRIC.md:29: "same project in two tracks is disallowed". Line 28 is the teams-of-1–3 rule. Strategy conclusion (kill Track 1 second submission) stands. |
| Toolchain installed: solana 3.1.10, anchor 1.1.2 | **SUPPORTED** | Command output: `solana-cli 3.1.10 (src:7bc9c805 … client:Agave)`, `anchor-cli 1.1.2`. |
| Wallet funded with devnet SOL (~5.5, CLAUDE.md:58) | **SUPPORTED** | `solana balance 2ZEiuuvqSFiZY4FEjBAhTutyqhEC7ajJruHPfzq4Eq68 --url https://api.devnet.solana.com` → `5.49792092 SOL`. |
| FIFA: 1.7B social engagements, video views +485% vs 2022 | **SUPPORTED** | FIFA media release (inside.fifa.com, 8 July 2026) states 30B impressions, **1.7 billion engagements** (TikTok+YouTube), 20B total video views, "video views are up **+485%**". Say "1.7B engagements on TikTok+YouTube" to be exact. |
| Polymarket sports taker fee = 0.75% | **UNSUPPORTED as a flat rate** | help.polymarket.com fees page confirms sports taker fees exist, formula `fee = C × feeRate × p × (1-p)`, makers pay nothing — but the flat "0.75%" figure does not appear in the retrieved page content. 0.75% is at most the effective maximum (feeRate × 0.25 at p=0.5). Pitch-safe phrasing: "under 1%, comparable to Polymarket's sports taker fee". |
| GoFundMe 2.9% comparison | **UNSUPPORTED** | Not verified in this pass (no source fetched). Plausible as the standard payment-processing rate but cite gofundme.com before putting it on a slide. |
| WinGive = conditional pledge (donate if your team wins) | **SUPPORTED** | wingive.com blog: "donate money to your favorite charity in honor of your favorite team's victory"; select game → team → amount → charity. Back-office (non-blockchain) mechanic consistent with competitor-scan. Peer-"challenge" detail not seen in retrieved pages — don't lean on it in Q&A. |
| scripts/connect.mjs exists and hits real endpoints | **SUPPORTED** (existence + plausibility only) | File exists; references `https://txline-dev.txodds.com`, devnet RPC, program `6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J`, IDL at `txline-examples/devnet/idl/txoracle.json`, state in `_keys/txline-session.json`. "Verified working" not re-run in this pass. |
| Sol-critique file:line citations (3 spot-checked) | **SUPPORTED** | track-02.md:17 = exact Real-Time criterion text ("actively unfolding on the pitch"); idea-01.md:112 = "keeper detects game_finalised via SSE" (supports final-whistle-only critique); idea-01.md:130 = "## Demo flow" heading (valid anchor for the three-tap-pledge claim). |
| Consensus score 43/100 | **SUPPORTED** (internal arithmetic) | Sol-critique rubric rows sum 8+7+17+7+4 = 43. It is one reviewer's score, not a multi-source consensus — label it as sol's score. |
| GoalLine confirmed as in-track competitor | **CANNOT-VERIFY** | Sourced only to listing comments; not independently checkable from here. Already correctly parked in the unknowns ledger. |

Net: no hallucinated files, no invented rules. Two fixes before the pitch: (1) cite RUBRIC.md:29, (2) soften the 0.75% Polymarket figure and source the GoFundMe 2.9% or drop the bracket.
