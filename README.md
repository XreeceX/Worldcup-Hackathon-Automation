# PledgePitch — Social Commitment Engine

**Conditional pledges, settled by the final whistle. No bookmaker. No committee. Just proof.**

Every World Cup, fans make millions of promises — none enforceable. PledgePitch turns a fan's promise into a protocol: an individual fan, or an open fan collective, locks SOL behind a match condition ("France wins", "both teams score", "3+ goals") with a beneficiary chosen upfront. When TxLINE finalises the match, the keeper fetches the Merkle proof and anyone can trigger on-chain resolution: the Anchor program CPIs into TxLINE's `validateStatV2`, and the vault either releases to the beneficiary **atomically** or opens pro-rata refunds. No admin key exists in the fund path.

**This is not betting** — there is no counter-party, no odds, and the pledger *wants* the condition to be true. It is a conditional donation with sport as the enforcement layer.

Built for the TxLINE World Cup Hackathon — **Track 1: Prediction Markets & Settlement**.

## How settlement works

```
fan signs pledge ──► Commitment PDA + Vault PDA (devnet SOL escrow)
fans join ────────► membership open until kickoff (on-chain clock enforced — no lock tx, no race)
match ends ───────► keeper hears game_finalised (SSE + polling, in parallel)
                    keeper fetches Merkle proof from TxLINE (real seq, never 0)
anyone resolves ──► program CPIs validateStatV2 against the on-chain Merkle root
   condition met ─► vault → beneficiary, same transaction
   not met ───────► members claim refunds individually, forever (last claim closes the vault)
```

The strategy evaluated on-chain is **derived inside the program** from the stored condition template — a resolver cannot substitute their own strategy or another match's proof.

## Trust model — what can't we do?

- We cannot redirect funds: no admin key, no upgradeable authority in the fund path; the beneficiary is fixed at signing.
- We cannot fake an outcome: resolution requires a Merkle proof that verifies against TxLINE's on-chain roots via CPI.
- We cannot trap funds: resolution and void are permissionless; an on-chain timeout guarantees member exit even if the oracle disappears.
- The keeper is a convenience, not a custodian — it holds API credentials, never funds.

## Repo map

| Path | What |
|---|---|
| `program/` | Anchor workspace — the Commitment settlement program (create/join/withdraw/resolve/claim_refund/void_timeout, TxLINE `validateStatV2` CPI) |
| `keeper/` | Keeper package (`keeper/src/`) — finalisation watcher, proof construction, auto-resolve, replay mode, HTTP API |
| `indexer/` | SQLite indexer — chain listener + board/claims/fixture query API |
| `web/` | **PledgePitch** Next.js 14 frontend — public board with market pulse, fixture browser, 3-step pledge wizard, live Match Centre, settlement ceremony, live ticker, claims. Ships same-origin BFF API routes so the Vercel deploy works without exposed backends. See `web/README.md` |
| `scripts/` | `connect.mjs` (TxLINE auth bootstrap) · `hourzero.mjs` (proof pipeline verification) · `e2e-devnet.mjs` / `e2e.mjs` (full settlement loops on devnet) · `demo-seed.mjs` (seed a demo pledge on a replay fixture) |
| `tifo/`, `keeper/*.mjs`, `scripts/demo-seed-tifo.mjs` | **TIFO** — the earlier sibling build (own Anchor program + indexer-lite keeper). Still runnable: `node keeper/index.mjs`, IDL vendored at `web/lib/idl/tifo.json`. See `docs/dev-log-01.md` |
| `docs/` | Requirements, design, UI spec, test plan, submission package, dev log |

## Quickstart

Prereqs: Node 20+, Docker (for the Solana/Anchor toolchain and Postgres — nothing installs on the host).

```bash
npm install                                # root deps (scripts)
node scripts/connect.mjs                   # one-time: subscribe on-chain + activate TxLINE API token
node scripts/hourzero.mjs                  # verify the proof pipeline end-to-end (read-only)

# services
cd keeper && npm install && npm start      # keeper + API on :3001
cd indexer && npm install && npm start     # indexer API on :3002
cd web && npm install && npm run dev       # PledgePitch frontend on :3000

# demo: seed a pledge on a replay fixture
node scripts/demo-seed.mjs 90
```

Commitment program (devnet): `3uyiF93zMvUcP2o1Cqnt2iS4bXwYeBcTMTvbaTf5B3RJ`
TIFO program (devnet): `2VeuFx8b2F5c1y5yuhgkCHdaHPMC5wDN4n1u4k5aMmkP`

Rebuild/redeploy the program (Docker only):

```bash
docker run --rm --platform linux/amd64 -v "$PWD":/work -w /work/program \
  -v tifo-cargo-registry:/usr/local/cargo/registry \
  solanafoundation/anchor:v0.31.1 sh -c 'anchor build && anchor deploy'
```

## TxLINE endpoints used

`/auth/guest/start` · `/api/token/activate` · `/api/fixtures/snapshot` · `/api/fixtures/updates` · `/api/fixtures/validation` · `/api/scores/stream` (SSE) · `/api/scores/updates/{epochDay}/{hour}/{interval}` · `/api/scores/stat-validation` · `/api/scores/historical/{fixtureId}` · on-chain CPI: `validate_stat_v2` (and `validate_fixture` for the void path)

## Keys & credentials

`_keys/` (gitignored) holds the keeper wallet, demo wallets, and the activated TxLINE session; the PledgePitch keeper/scripts also read `~/.secrets/txline-devnet-*.json`. `program/target/deploy/` and `tifo/target/` (gitignored) hold program deploy keypairs. Nothing secret is committed; committed IDLs live at `web/lib/idl/commitment.json` and `web/lib/idl/tifo.json`.
