# TIFO — Put it on the line.

**Conditional pledges, settled by the final whistle. No bookmaker. No committee. Just proof.**

Every World Cup, fans make millions of promises — none enforceable. TIFO turns a fan's promise into a protocol: an individual fan, or an open fan collective, locks SOL behind a match condition ("France wins", "both teams score", "3+ goals") with a beneficiary chosen upfront. When TxLINE finalises the match, the keeper fetches the Merkle proof and anyone can trigger on-chain resolution: the Anchor program CPIs into TxLINE's `validateStatV2`, and the vault either releases to the beneficiary **atomically** or opens pro-rata refunds. No admin key exists in the fund path.

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
- We cannot trap funds: resolution and void are permissionless; a 7-day on-chain timeout guarantees member exit even if the oracle disappears.
- The keeper is a convenience, not a custodian — it holds API credentials, never funds.

## Repo map

| Path | What |
|---|---|
| `tifo/` | Anchor workspace — the settlement program (6 instructions, zero-copy 200-member DAO account) |
| `keeper/` | Node service: SSE + polling finalisation watcher, proof construction, auto-resolve, replay mode, and the frontend's live-data API (feed SSE, score proxy, board queries) |
| `web/` | Next.js 14 frontend — public board, pledge wizard, live Match Center, settlement ceremony, claims |
| `scripts/` | `connect.mjs` (TxLINE auth bootstrap) · `hourzero.mjs` (proof pipeline verification) · `e2e.mjs` (full YES/NO/claim/idempotency test on devnet) · `demo-seed.mjs` |
| `docs/` | Requirements, design, UI spec, test plan, submission package |

## Quickstart

Prereqs: Node 20+, Docker (for the Solana/Anchor toolchain — nothing installs on the host).

```bash
npm install                                # root deps (keeper + scripts)
node scripts/connect.mjs                   # one-time: subscribe on-chain + activate TxLINE API token
node scripts/hourzero.mjs                  # verify the proof pipeline end-to-end (read-only)
node scripts/e2e.mjs                       # full settlement loop against devnet

# services
REPLAY_FIXTURE_ID=18241006 node keeper/index.mjs    # keeper + API on :3001
cd web && npm install && npm run dev                # frontend on :3000

# demo: seed a DAO and replay a real finalised match through the live pipeline
node scripts/demo-seed.mjs 90
curl -X POST "localhost:3001/api/replay/run?speedMs=200"
```

Program (devnet): `2VeuFx8b2F5c1y5yuhgkCHdaHPMC5wDN4n1u4k5aMmkP`

Rebuild/redeploy the program (Docker only):

```bash
docker run --rm --platform linux/amd64 -v "$PWD":/work -w /work/tifo \
  -v tifo-cargo-registry:/usr/local/cargo/registry \
  solanafoundation/anchor:v0.31.1 sh -c 'anchor build && anchor deploy'
```

## TxLINE endpoints used

`/auth/guest/start` · `/api/token/activate` · `/api/fixtures/snapshot` · `/api/fixtures/updates` · `/api/fixtures/validation` · `/api/scores/stream` (SSE) · `/api/scores/updates/{epochDay}/{hour}/{interval}` · `/api/scores/stat-validation` · `/api/scores/historical/{fixtureId}` · on-chain CPI: `validate_stat_v2` (and `validate_fixture` for the void path)

## Keys & credentials

`_keys/` (gitignored) holds the keeper wallet, demo wallets, and the activated TxLINE session. `tifo/target/` (gitignored) holds the program deploy keypair. Nothing secret is committed; the program IDL is vendored at `web/lib/idl/tifo.json`.
