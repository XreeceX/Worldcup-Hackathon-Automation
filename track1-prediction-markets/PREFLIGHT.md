# PREFLIGHT.md — LEGATO TxLINE / Solana spikes

Prove these **before** building UI. Check boxes only when observed live (not assumed).

## A. Credentials (no secrets in git)

- [ ] Run `../txline-setup/setup.mjs` (or equivalent) → wallet + creds in `~/.secrets/`
- [ ] Confirm files are **outside** the repo and gitignored if any local copies exist
- [ ] `.env.example` documents vars only; real JWT / API token never committed

Expected headers for data calls:

```
Authorization: Bearer <guest JWT>
X-Api-Token: <activated token>
```

401 → renew JWT, keep same API token. 403 on activate → wrong message/wallet/network.

## B. Network lock (devnet only for hackathon)

| Item | Value |
|---|---|
| RPC | `https://api.devnet.solana.com` |
| Program | `6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J` |
| API origin | `https://txline-dev.txodds.com` |
| Service level | `1` |
| Activation message (empty leagues) | `${txSig}::${jwt}` |

- [ ] One successful `GET /api/fixtures/snapshot`
- [ ] One successful `GET /api/odds/snapshot/{fixtureId}`
- [ ] One successful `GET /api/scores/snapshot/{fixtureId}` or historical
- [ ] SSE open on `/api/scores/stream` (heartbeats OK even if quiet)

## C. Proof / settlement spike (gates on-chain work)

- [ ] Discover real `seq` ≥ 1 from a score record (never invent 0)
- [ ] Prefer `action=game_finalised` / statusId 100 for FT
- [ ] `GET /api/scores/stat-validation?fixtureId=&seq=&statKeys=1,2`
- [ ] Derive `daily_scores_roots` from proof `minTimestamp` epoch day
- [ ] Simulate `validateStatV2` with `.view()` + 1.4M CU — **equality / known-true predicate first**
- [ ] Document one failing case (wrong epoch day or IncompleteStatCoverage) for feedback field

Fallback if V2 blocked:

- [ ] Same fixture with `statKey=1` + `validateStat` `.view()` succeeds

## D. Can't-do / friction log (paste into Superteam feedback)

| Observed | Severity | Workaround |
|---|---|---|
| OpenAPI YAML `docs.yaml` returned 500 when fetched 2026-07-18 | Med | Use examples + llms.txt |
| Superteam listing body thin in scrape (prizes ok; long brief incomplete) | Low | Use RUBRIC track sentence |
| tx-on-chain GitHub README empty on fetch | Low | Use TxLINE docs examples |
| Historical scores only for fixtures started 2w–6h ago | High for demo | Maintain seeded fixtureId list; rotate |

## E. Local tooling

- [ ] Node 20+
- [ ] Anchor build environment OR use prebuilt deploy from CI later
- [ ] Devnet SOL funded (airdrop)
- [ ] Phantom (or equiv) on devnet for UI stake path
