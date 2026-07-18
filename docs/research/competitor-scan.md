# Competitor & Adjacent-Market Scan — Social Commitment Engine (Track 2)

Produced by researcher agent (Sonnet 5), 2026-07-18 ~17:08 BST. Status: partial-success (in-track submission list not externally indexed).

## 1. Direct hackathon competitors (Consumer & Fan Experiences track)

Superteam Earn's submission list is not externally indexed — named in-track competitors mostly unretrievable via web search. Two known signals:

1. **GoalLine** — live World Cup prediction market + Telegram alerts for goals/cards/odds shifts, powered by TxLINE. **Source: the listing's own comment section** (comment by "Gift Visuals", pasted from the live listing 2026-07-18 16:55 BST) — verified primary source, lead resolved this after the scan flagged it unfindable via search. **Overlap: medium** — prediction market with Telegram alerts, not conditional charity pledges; but same track, same TxLINE feed, likely polished.
2. **World (world.xyz)** — fully onchain prediction market live inside Phantom wallet, trading BTC and 2026 World Cup event contracts, Chainlink-settled, CASH stablecoin. Launched independently ~July 1 2026; hackathon affiliation unconfirmed. **Overlap: medium** — same chain + event, but betting market with counterparties, not conditional charity pledge. [CoinDesk](https://www.coindesk.com/web3/2026/07/01/mysterious-solana-project-world-unveiled-as-fully-onchain-prediction-market), [BeInCrypto](https://beincrypto.com/world-solana-prediction-market-phantom/)

## 2. Adjacent existing products

3. **WinGive** — fans pledge to a charity; if their team wins, pledge becomes a donation; peer "challenges" send loser's pledge to winner's charity. **Overlap: HIGH** — closest match to our core concept. Gap: no blockchain, no trustless settlement, no cryptographically verified feed — back-office settled. [WinGive blog](https://www.wingive.com/blog)
4. **stickK** — Yale commitment-contract platform: stake money on personal goals, charity/anti-charity on failure, human referee. **Overlap: medium** — proven pledge+charity demand; not sports, not crypto, human-verified. [stickK FAQ](https://www.stickk.com/faq/stakes/Commitment+Contracts)
5. **PledgeIt / 99Pledges / RallyUp "a-thons"** — web2 pledge-per-goal fundraising, manual settlement, school/team focus. **Overlap: medium.** [RallyUp](https://rallyup.com/a-thons/), [PledgeIt](https://www.pledgeit.org/)
6. **BetDEX** — non-custodial Solana sports-betting exchange (Monaco protocol), instant on-chain settlement. **Overlap: medium** — same chain + trustless-settlement pattern, but peer-vs-peer wagering, no charity. [Solana Compass](https://solanacompass.com/projects/betdex), [PR Newswire](https://www.prnewswire.com/news-releases/betdex-exchange-now-live-on-solana-mainnet-301686584.html)
7. **Overtime Markets (Thales)** — decentralized sportsbook/parlays, EVM, marketing WC2026 parlays. **Overlap: low-medium.** [docs.overtime.io](https://docs.overtime.io/learn-about-overtime/history-of-overtime)
8. **Azuro Protocol** — multi-chain decentralized betting infrastructure for 30+ apps. **Overlap: low** — plumbing, not Solana, not charity. [azuro.org](https://azuro.org/)
9. **Endaoment** — Ethereum donor-advised fund, crypto→any nonprofit onchain. **Overlap: low-medium** — solves trustless charity payout leg; no conditional trigger, no sports. [endaoment.org](https://endaoment.org/)
10. **Pledge.to / PledgeCrypto** — crypto-donation payment rail for nonprofits. **Overlap: low.** [pledge.to](https://www.pledge.to/solutions/pledge-crypto)
11. **Fan tokens (Socios/Chiliz)** — governance/engagement tokens, some charity votes/win burns. **Overlap: low.** [Cryptobriefing](https://cryptobriefing.com/world-cup-semi-finals-crypto-fan-tokens/)

## Overlap summary

| Risk | Products |
|---|---|
| High | WinGive |
| Medium | GoalLine (in-track), World (world.xyz), stickK, PledgeIt/99Pledges/RallyUp, BetDEX |
| Low-medium | Overtime Markets, Endaoment |
| Low | Azuro, Pledge.to, fan tokens |

## Draft judge answer: "How is this different from X?"

The closest existing product, WinGive, already proves fans want outcome-triggered charitable pledges — but it runs on manual back-office settlement with no independent verification of the sports result and no on-chain trust guarantee, and stickK proves the same demand for accountability-linked charity stakes outside sports entirely. Betting-exchange products like BetDEX, Overtime, and Azuro solve trustless on-chain settlement on live sports data, but they're built around wagering with a counterparty — legally and philosophically the opposite of what we're doing. Our Social Commitment Engine is the first to combine both halves correctly for this event: a pledge with no counterparty and a pre-chosen beneficiary (not a bet), settled trustlessly by a cryptographically signed, Merkle-proof-verified live data feed (TxLINE) rather than a centralized operator's word. In short: **WinGive's mission, BetDEX's trust model, neither one's product.**

## Unknowns

- Full in-track submission list not externally viewable; only dashboard access would show real competitors pre-judging.
- World (world.xyz) hackathon affiliation unconfirmed.
