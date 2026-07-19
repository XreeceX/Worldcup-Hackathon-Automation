# Dev Log — TIFO Build Session (2026-07-18 → 2026-07-19)

Chronological record of the build night: what was done, every issue hit and its fix, current runtime state, and which files are obsolete. Written ~01:45 BST Jul 19; local submission deadline 12:00 BST, global 23:59 UTC.

---

## 1. What was done, in order

1. **Track decision** — Idea 01 (Social Commitment Engine) evaluated against all three tracks; submitted to **Track 1: Prediction Markets & Settlement**. Full reasoning in `track-evaluation.md`. Product named **TIFO**.
2. **Doc pass** — fixed `gameState=6` → `16` cancellation bug in five places in `design-01.md`; aligned req/design on templates and ESCROW_MODE; generated `ui-spec-01.md`, `test-plan-01.md`, `submission-01.md`, `kickoff-checklist.md`. Demo declared **replay-only** (fixture `18241006`, England vs Argentina, final 1–2).
3. **Hour-zero pipeline proof** — before any product code: TxLINE auth bootstrap (`scripts/connect.mjs`), historical record fetch, stat-validation proof with real `seq=962`, `validateStatV2` `.view()` returning BTTS=true / HomeWin=false. Settlement thesis proven at hour one.
4. **`Add` discovery** — the IDL's `BinaryExpression` enum contains `Add`, contradicting the boilerplate docs and the design's descope of "Total goals ≥ N". Verified against the real proof (`total>=3`=true, `total>=4`=false). **Template 2 (TotalGoals) reinstated** in program, UI, and docs.
5. **Anchor program** (`tifo/`) — six instructions (`create_commitment`, `join`, `withdraw`, `resolve`, `claim_refund`, `void_timeout`), zero-copy `Commitment` account with pre-allocated member array, lazy locking via stored kickoff timestamp, hybrid push/pull settlement. Security hardening beyond design doc: resolve **strategy is built on-chain** from the stored template (a caller-supplied strategy could invert outcomes) and the proof's `fixture_id` must match the commitment's.
6. **Keeper** (`keeper/`) — SSE + polling finalisation watchers in parallel (all four `build-bugs.md` classes structurally prevented), proof construction with retry, auto-resolve, feed events emitted only after tx confirmation, accelerated replay mode, HTTP API (feed SSE, per-fixture score proxy, health, manual resolve, replay trigger).
7. **Indexer descoped to indexer-lite** — no Postgres. Board/claims/fixture queries served from cached `getProgramAccounts` scans inside the keeper (`keeper/board.mjs`). Same API shape as designed; on-chain state remains source of truth. Rationale: at demo scale a 4-second-TTL chain scan is strictly simpler and equally fast.
8. **Frontend** (`web/`, Next.js 14 + Tailwind + wallet-adapter + framer-motion) — board with stat tiles and feed rail, matches list, 3-step pledge wizard, commitment page with Match Center (countdown → LOCKED → live scoreboard → condition banner), settlement ceremony (confetti + gold count-up), perforated proof receipt, claims page, toasts, live ticker.
9. **E2E on devnet** (`scripts/e2e.mjs`) — green: YES path (vault → beneficiary atomically), NO path (Refunded), `claim_refund` (exact refund, vault swept to 0, rent to last claimer), resolve idempotency (`NotOpen`). All against real TxLINE proofs.
10. **In-browser full-arc test** — seeded a real 2-member DAO (`demo-seed.mjs`), watched countdown → LOCKED → replayed match → goals rolled the scoreboard → keeper resolved on-chain → ceremony fired → receipt rendered → board totals updated. Several bugs found and fixed (see §2).
11. **Shipped** — README, `.env.example`, gitignore hardening, all pushed to `dev-talha` (`7e3faad`).

## 2. Issues faced and how they were fixed

| # | Issue | Fix |
|---|---|---|
| 1 | Rust was installed on the host via rustup before the no-host-installs rule was set | User removed it (`rustup self uninstall` + env lines in `~/.zshenv`/`~/.profile`); **all toolchain work moved to Docker** (`solanafoundation/anchor:v0.31.1`) |
| 2 | Anchor/Solana Docker images are amd64-only; host is Apple Silicon | Run under Rosetta emulation with a named volume for the cargo registry; ~1 min builds — acceptable |
| 3 | Devnet airdrop returned hard 429s (per-IP daily limit) | User funded keeper wallet via faucet.solana.com; inter-wallet transfers used after that |
| 4 | `/scores/historical/{id}` returns **SSE-formatted text** (`data: {...}` lines) with **PascalCase** fields (`Action`, `Seq`, `StatusId`), not a JSON array | Parser in `keeper/txline.mjs` (`parseSseRecords`); all field access tolerates both casings |
| 5 | **edition2024 crate storm**: the image's SBF toolchain bundles cargo 1.79; fresh crates.io resolution pulls crates needing edition2024 | Lockfile pins (committed in `tifo/Cargo.lock`): blake3→1.5.5, proc-macro-crate→3.1.0, zeroize→1.8.1, indexmap→2.7.0, hashbrown→0.15, shlex→1.3.0, cc→1.2.16, bytemuck_derive→1.8.1 (+ `bytemuck = "=1.19.0"` in Cargo.toml), zerocopy→0.8.25, unicode-segmentation→1.12.0. **Never run bare `cargo update` — it re-breaks the build** |
| 6 | `declare_program!(txoracle)` generated invalid Rust from the IDL's `constants` (base58 pubkeys emitted as identifiers) + missing `bytemuck` dep | Stripped `constants: []` in **`tifo/idls/txoracle.json`** (this copy is deliberately modified — see §4); added explicit bytemuck dependency |
| 7 | `create_commitment` failed `Failed to reallocate account data` — Solana caps **CPI-created accounts at 10,240 bytes**; the 500-member account was 24KB | Member cap **500 → 200** (9,768 bytes incl. discriminator). Docs updated. Larger caps need an incremental-realloc flow (post-hackathon) |
| 8 | Program upgrades need a ~1.83 SOL buffer we didn't have; **closed program IDs can never be redeployed** | The low-balance upgrade dance: `solana program close` (refunds ~1.83 SOL) → generate a **new** program keypair → sync `declare_id!`/Anchor.toml → build → deploy. Done twice; see dead IDs in §4 |
| 9 | PDA seeds `[fixture_id, founder]` meant **one commitment per founder per fixture** (collision discovered when demo-seed hit the e2e account) | Added client-supplied `nonce: u64` to create args and PDA seeds; frontend passes `Date.now()` |
| 10 | Post-resolution UI showed "awaiting on-chain settlement…" *after* settlement (inverted ternary) and waited on a slow poll to flip to the receipt | Banner logic corrected; a `resolved` feed event now settles the view immediately, receipt status falls back to the event's status until the next fetch |
| 11 | Cosmetics found in browser: England flag emoji rendered as a box (needs the tag-sequence emoji), receipt perforation mask cut through mid-card text, "Total pledged 0 SOL" looked dead once everything settled | Tag-sequence flag; mask moved to top-edge notches; stat tiles reworked (On the line / Commitments / gold Released to causes) |
| 12 | First page load of a route on the dev server can outlast one SWR error cycle ("Loading commitment…") | Benign (dev-only compile latency); production build + `next start` for anything on camera |

## 3. Current runtime state

- **Program (LIVE)**: `2VeuFx8b2F5c1y5yuhgkCHdaHPMC5wDN4n1u4k5aMmkP` on devnet. Deploy authority + resolver + TxLINE API subscriber: `_keys/wallet.json` (`7ZozrU2…1ded`) — the API token is bound to this wallet's subscribe tx.
- **Services**: keeper on :3001 (replay mode, nohup, log `/tmp/keeper.log`), web production build on :3000 (nohup, log `/tmp/web.log`).
- **Wallets** (`_keys/`, gitignored): `wallet.json` ~0.26 SOL · `demo-pledger.json` · `demo-joiner.json` (~1.1 SOL combined). Each program-logic change costs a ~1.83 SOL close/redeploy cycle — top up before touching `lib.rs`.
- **Demo choreography**: `node scripts/demo-seed.mjs 90` → watch countdown/lock → `curl -X POST "localhost:3001/api/replay/run?speedMs=200"` → ceremony ~20s later. Replay is re-runnable.
- **Canonical replay facts**: fixture `18241006`, finalised `Seq=962`, final score 1–2 (BTTS=true, HomeWin=false, TotalGoals≥3=true — one fixture covers YES and NO demos).

## 4. Obsolete / do-not-use files (future sessions read this first)

| Path | Status | Notes |
|---|---|---|
| `txline-setup/` | **Obsolete** | Pre-session bootstrap variant that writes creds to `~/.secrets/`. Superseded by `scripts/connect.mjs` (creds in `_keys/`). Never used; do not run — it would create a second wallet/subscription |
| `docs/build-bugs.md` | **Historical only** | Describes bugs in example code (`server/txline.mjs`, `server/keeper.mjs`) that **never existed in this implementation**. The real keeper was written with these classes prevented. Do not go looking for those files |
| `docs/ideas/idea-01-review.md` | Historical | All findings absorbed into req-01/design-01 resolutions |
| `archieve/` | Reference only | Hackathon track briefs and discarded ideas |
| Program IDs `G3EGVoGzAhtfeA5tufjL34oHF9Ky9YvpwuQ7K3aYcidE` and `7N234kjKB629vuuSwvsC3ituFjcbcJ4QY57wbko28Kdy` | **Dead** | Closed to reclaim rent; can never be redeployed. Orphaned e2e commitment accounts exist under them — ignore. Any doc/log mentioning them is stale |
| `txline-examples/devnet/idl/txoracle.json` | **Live dependency — but do not copy over `tifo/idls/txoracle.json`** | Keeper and scripts load the txoracle IDL from here. The copy at `tifo/idls/txoracle.json` has `constants` **deliberately stripped** for `declare_program!`; overwriting it from the examples copy re-breaks the Rust build |
| `tifo/target/` | Gitignored, machine-local | Holds the deploy keypair (secret) and fresh build IDL. The **committed** tifo IDL lives at `web/lib/idl/tifo.json`; keeper falls back to it when `target/` is absent |
| `docs/design-01.md` §8 (Postgres indexer), FR-14 as written | Superseded in implementation | Indexer-lite inside the keeper serves the same query API; Postgres schema unimplemented by decision (see §1.7) |
| Root `scripts/connect.mjs`, `hourzero.mjs`, `e2e.mjs`, `demo-seed.mjs` | **Current and canonical** | Listed here to remove doubt — these are the real operational scripts |

## 5. Open items at time of writing

Hosting (Vercel for `web/`, Railway/Fly for keeper) — blocked on user logins. Faucet top-up for redeploy headroom. Demo video recording (script: `submission-01.md` §3). Superteam Earn + London Google form — user-only. Claims-page UI untested in browser (claim path itself e2e-verified on-chain; UI states code-reviewed only).
