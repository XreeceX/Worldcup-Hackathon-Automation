# Commitment Indexer

Off-chain indexer for the Social Commitment Engine (design-01.md §8). It:

- mirrors on-chain `Commitment` accounts into Postgres via `connection.onLogs`
  (Anchor event parsing) plus a `getProgramAccounts` reconciliation sweep on
  startup and every 10 minutes,
- caches the TxLINE fixture snapshot (World Cup, competitionId=72) and
  refreshes it every 10 minutes,
- serves the read-only query API used by the public board, commitment detail
  and pending-claims views.

It is read infrastructure only — on-chain state is always the source of truth.

## Setup

```bash
# 1. Start Postgres (from the repo root)
docker compose up -d

# 2. Install and run (from indexer/)
npm install
npm start
```

Configuration is via environment variables — see `.env.example` for the full
list and defaults. Everything has a working default; with no TxLINE
credentials the fixtures table stays empty (warning logged), and with no IDL
file at `program/target/idl/commitment.json` the event listener polls every
15 s and attaches once `anchor build` produces it.

Note: the compose file maps Postgres to **host port 5433** (5432 was already
in use on the dev machine), and the default `DATABASE_URL` matches.

## Endpoints (default port 3002)

| Endpoint | Description |
|---|---|
| `GET /api/board` | Commitment list joined with fixture names. Query params: `status=Open\|Executed\|Refunded\|Void\|Closed`, `fixture_id=<id>`, `sort=total_lamports\|member_count\|created_at` (desc, default `total_lamports`), `limit` (default 50, max 200), `offset`. |
| `GET /api/commitment/:pubkey` | Full commitment detail including the `members` array. |
| `GET /api/claims?wallet=<pubkey>` | Unclaimed deposits of that wallet on `Refunded`/`Void` commitments, with amount and fixture info. |
| `GET /api/fixtures?status=upcoming\|live\|finished` | Cached TxLINE fixtures; status derived from `game_state` + kickoff vs now. No filter → all. |
| `GET /api/health` | `{ ok, dbConnected, listenerRunning, lastEventSlot }` |

Board/commitment rows have the shape:

```json
{
  "pubkey": "...", "fixtureId": 18257865,
  "conditionTemplate": 1, "conditionParam": 0, "conditionLabel": "France wins",
  "beneficiary": "...", "founder": "...", "name": "France DAO",
  "status": "Open", "memberCount": 3, "totalLamports": 1500000000,
  "homeTeam": "France", "awayTeam": "England", "kickoffTs": 1784840400000,
  "settlementTx": null
}
```

`GET /api/feed` is intentionally not served here — the frontend consumes the
keeper's SSE feed directly (port 3001).

## Tests

```bash
npm test   # node:test — pure helpers: labels, fixture-id decoding, name strip, board SQL builder
```
