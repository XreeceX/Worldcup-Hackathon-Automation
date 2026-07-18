# Keeper — Social Commitment Engine

Node.js service that watches TxLINE for `game_finalised` events and auto-resolves
on-chain commitments (design-01.md §7). It is the only service holding TxLINE API
credentials and the resolver wallet, and it proxies live scores to the frontend so
credentials never reach the browser.

## Requirements

- Node v24 (plain ESM `.mjs`, no build step)
- `npm install` inside `keeper/`
- The Anchor program IDL at `../program/target/idl/commitment.json` (produced by
  `anchor build` in `program/`). Without it the HTTP server still runs, but
  resolve/void transactions are unavailable.

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `ANCHOR_WALLET` | Yes | Path to resolver keypair JSON |
| `ANCHOR_PROVIDER_URL` | Yes | Solana devnet RPC URL (`https://api.devnet.solana.com`) |
| `TXLINE_JWT` | Yes* | Initial TxLINE JWT (auto-renewed on 401) |
| `TXLINE_API_TOKEN` | Yes* | Stable TxLINE API token (never rotated by the keeper) |
| `ESCROW_MODE` | Yes | `on-chain` (only implemented mode) |
| `PROGRAM_ID` | Yes | Deployed Commitment program (`3uyiF93zMvUcP2o1Cqnt2iS4bXwYeBcTMTvbaTf5B3RJ`) |
| `INDEXER_URL` | Yes | Base URL of the indexer query API (e.g. `http://localhost:3002`) |
| `PORT` | No | Keeper HTTP port (default `3001`) |
| `REPLAY_FIXTURE_ID` | No | If set, skips SSE/polls and replays a historical fixture |
| `POLL_INTERVAL_MS` | No | Score/fixture poll interval (default `30000`) |
| `IDL_PATH` | No | IDL path override (default `../program/target/idl/commitment.json`) |

\* If `TXLINE_JWT` / `TXLINE_API_TOKEN` are unset, the keeper reads `jwt` and
`apiToken` from `~/.secrets/txline-devnet-creds.json` (written by
`txline-setup/setup.mjs`). Boot fails fast with a list of everything missing.

See `.env.example` for a template.

## Running

Live mode (SSE at boot + 30s polling fallback + cancel detection):

```bash
ANCHOR_WALLET=./resolver-keypair.json \
ANCHOR_PROVIDER_URL=https://api.devnet.solana.com \
ESCROW_MODE=on-chain \
PROGRAM_ID=3uyiF93zMvUcP2o1Cqnt2iS4bXwYeBcTMTvbaTf5B3RJ \
INDEXER_URL=http://localhost:3002 \
node src/index.mjs
```

Replay mode (demo — docs/demo.md; e.g. England vs Argentina `18241006`):

```bash
REPLAY_FIXTURE_ID=18241006 \
ANCHOR_WALLET=./resolver-keypair.json \
ANCHOR_PROVIDER_URL=https://api.devnet.solana.com \
ESCROW_MODE=on-chain \
PROGRAM_ID=3uyiF93zMvUcP2o1Cqnt2iS4bXwYeBcTMTvbaTf5B3RJ \
INDEXER_URL=http://localhost:3002 \
node src/index.mjs
```

Replay fetches `/scores/historical/{id}`, finds the record with
`action=game_finalised` and `statusId=100`, and feeds its real `seq` into the same
resolve pipeline as live mode. Feed and score-proxy endpoints behave identically.

## HTTP API

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/feed` | SSE stream of resolution/void events (15s heartbeats, recent-event catch-up) |
| `GET` | `/api/scores/live?fixtureId=<id>` | SSE proxy of the TxLINE score stream filtered to one fixture |
| `GET` | `/api/commitments/:fixtureId` | Open commitments for a fixture (indexer proxy, on-chain fallback) |
| `POST` | `/api/resolve/:commitmentPubkey` | Manual resolve trigger (keeper-down fallback) |
| `GET` | `/api/health` | `{ ok, mode: live\|replay, sse: connected\|disconnected }` |

CORS is enabled for `http://localhost:3000` (the frontend).

## Behaviour notes (bug fixes baked in)

- **BUG-01** — resolution fires only on `action=game_finalised && statusId=100`.
- **BUG-02** — `seq` is never defaulted to 0; a missing seq is a hard error.
- **BUG-03** — feed events are emitted only after the resolve tx confirms and the
  on-chain account has been re-read (Executed vs Refunded).
- **BUG-04** — the live SSE subscription starts at boot; replay is opt-in.
- Cancel detection voids only on packed `gameState == 16` (Cancelled); 6 is WaitET.
- "Already resolved" (`NotOpen`) program errors are treated as success-skips (FR-13.5).
- `epochDay` for the `daily_scores_roots` PDA comes from the proof's
  `summary.updateStats.minTimestamp`, never wall clock.

## Tests

```bash
npm test            # node:test unit suite (proof mapping, epoch day, gameState, URLs, filters)
```
