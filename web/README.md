# PledgePitch — Social Commitment Engine frontend

Fans lock conditional pledges ("Both teams score", "Argentina wins") on World
Cup matches. Funds escrow on Solana devnet; TxLINE's Merkle proof resolves them
trustlessly — condition met → beneficiary paid, not met → members reclaim.
Individual pledges and group Fan DAOs are the same primitive. Not betting:
no counterparty, beneficiary chosen upfront.

## Stack

Next.js 14 (app router) · TypeScript · Tailwind CSS ·
`@solana/wallet-adapter-*` (Phantom, Solflare; Backpack via wallet standard) ·
`@coral-xyz/anchor` 0.31 · react-hot-toast · vitest.

## Run

```bash
npm install
cp .env.example .env.local   # defaults work for local dev
npm run dev                  # http://localhost:3000
```

The board and commitment pages load without a wallet and degrade gracefully
when the indexer/keeper are down ("Data may be delayed" banner, reconnecting
SSE states). Write actions (create / join / withdraw / claim / void) need a
devnet wallet.

## Deploy (Vercel)

1. Import the GitHub repo on [vercel.com](https://vercel.com).
2. Set **Root Directory** to `web` (critical — monorepo).
3. Add Environment Variables:

| Name | Required | Value |
|---|---|---|
| `NEXT_PUBLIC_RPC_URL` | yes | `https://api.devnet.solana.com` |
| `NEXT_PUBLIC_PROGRAM_ID` | yes | `3uyiF93zMvUcP2o1Cqnt2iS4bXwYeBcTMTvbaTf5B3RJ` |
| `TXLINE_API_TOKEN` | yes (scores) | from `~/.secrets/txline-devnet-creds.json` → `apiToken` |
| `TXLINE_JWT` | optional | guest JWT (auto-refreshed if omitted) |
| `NEXT_PUBLIC_INDEXER_URL` | **leave unset** | same-origin `/api/*` BFF |
| `NEXT_PUBLIC_KEEPER_URL` | **leave unset** | same-origin `/api/*` BFF |

4. Deploy. Do **not** point indexer/keeper at localhost — on Vercel the Next.js
   API routes mirror the local indexer+keeper (board from chain, scores from TxLINE).

## Environment (`NEXT_PUBLIC_*`)

| Variable | Default | Purpose |
|---|---|---|
| `NEXT_PUBLIC_RPC_URL` | `https://api.devnet.solana.com` | Solana devnet RPC |
| `NEXT_PUBLIC_PROGRAM_ID` | `3uyiF93zMvUcP2o1Cqnt2iS4bXwYeBcTMTvbaTf5B3RJ` | Commitment program |
| `NEXT_PUBLIC_INDEXER_URL` | local `http://localhost:3002` / Vercel `""` | Indexer (or same-origin BFF) |
| `NEXT_PUBLIC_KEEPER_URL` | local `http://localhost:3001` / Vercel `""` | Keeper (or same-origin BFF) |

## Pages

| Route | Wallet | Purpose |
|---|---|---|
| `/` | No | Public board: commitment grid, fixture/status filter, sort, live settlement feed |
| `/fixture/[id]` | Create only | Fixture header + existing commitments + 3-step create wizard |
| `/commitment/[pubkey]` | Actions only | On-chain detail, in-play card (live score + condition status + event log), join/withdraw/resolve/void/claim |
| `/claims` | Yes | Pending refunds for the connected wallet |

## Anchor client & IDL

`lib/escrow.ts` implements `EscrowInterface` with `AnchorEscrow` (the only
implementation — on-chain mode). The IDL at `lib/idl/commitment.json` is a
**hand-written stub** matching `program/programs/commitment/src/lib.rs`
(instructions the frontend signs itself: `create_commitment`, `join`,
`withdraw`, `claim_refund`, `void_timeout`; `resolve` goes through the keeper's
`POST /api/resolve/:pubkey`). Once the Anchor build emits the real IDL:

```bash
npm run sync-idl   # copies ../program/target/idl/commitment.json over the stub
```

## Tests & build

```bash
npm test        # vitest: condition labels, lamports/SOL formatting, name encoding
npm run build   # production build (type-checked)
```
