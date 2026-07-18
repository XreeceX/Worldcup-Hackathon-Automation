# 02-BACKEND-SPEC — Keeper + API server

> **Track sentence (verbatim from archieve/tracks/track-02.md):** "Most fans watching the World Cup are doing it with a phone in their hand. TxLINE gives you live scores, real-time odds, and match events for all 104 games, the kind of data that until now only the big operators could access. We want to see what builders who are also fans do with it. The experiences that could exist here have not been built yet."
> **Persona (real fan):** Supavich — real fan, London hackathon builder. The group-chat promise nobody ever keeps: "if we win this one, I'll donate a tenner" — said every match, kept never. (Relatable anecdote, not a cited statistic.)
> **Wow moment:** Final whistle → keeper fires → SOL visibly moves + explorer link with Merkle proof — no human touched it.

## 1. Architecture + stack (decided, not optional)

- **Runtime:** Node.js (ES modules, `.mjs`), Express. One process runs both the REST/SSE server and the keeper loop.
- **TxLINE:** devnet host `https://txline-dev.txodds.com`. Auth reuses the working `scripts/connect.mjs` pattern: guest JWT → API token, session persisted in `_keys/txline-session.json`. Never hardcode credentials; `_keys/` stays gitignored.
- **Solana:** `@solana/web3.js` against devnet RPC. Keeper keypair loaded from a gitignored keyfile path via env.
- **Persistence:** in-memory pledge map + JSON file snapshot on every write (survives restarts; no DB in a 24h build). Lamports serialize as decimal strings, parse back to `BigInt`.
- **Escrow: DUAL-PATH behind one interface** (see §2 `escrow/`). Selected once at boot by env `ESCROW_MODE=anchor|custody`. The frontend and the REST contract never reveal which path is live.
  - **Path A (preferred, gated on the 30-min Anchor smoke test — masterplan strategy change #2):** minimal Anchor program with exactly two instructions, `create_pledge` (moves lamports into an escrow PDA derived from `[b"pledge", pledge_id]`) and `resolve` (keeper-authority signer; releases PDA lamports to beneficiary, or back to pledger when the condition failed). Condition validation happens in the keeper against TxLINE's stat-validation Merkle proof; if the smoke test shows the TxOracle CPI is cheap to wire, `resolve` additionally CPIs `validateStatV2` — stretch, not a gate.
  - **Path B (fallback, stated honestly in docs/video):** keeper-custody escrow wallet. Create tx is a plain `SystemProgram.transfer` from pledger to the escrow wallet; release is a keeper-signed `SystemProgram.transfer` to the beneficiary.

## 2. Module breakdown — one module = one responsibility, one file each

| File | Responsibility |
|---|---|
| `server/index.mjs` | Boot: load config/env, init store, pick escrow impl from `ESCROW_MODE`, start Express + keeper |
| `server/routes.mjs` | REST endpoints + SSE relay exactly as 03 defines; no business logic |
| `server/store.mjs` | Pledge store: CRUD, bigint-safe JSON snapshot/restore, totals for the invariant |
| `server/conditions.mjs` | **Pure** condition logic: `evaluate(condition, stats) → boolean`, `progress(condition, stats) → string`; no I/O, no imports beyond types |
| `server/txline.mjs` | TxLINE client: session auth (connect.mjs pattern), fixtures fetch, scores/events SSE subscription, stat-validation proof fetch |
| `server/keeper.mjs` | Keeper loop: on `game_finalised` → fetch stat-validation proof → `conditions.evaluate` → `escrow.release` → state transitions; idempotent |
| `server/escrow/interface.mjs` | The dual-path contract: `prepareCreate(params) → unsigned tx / instructions for frontend`, `confirmCreate(signature) → verified deposit lamports`, `release(pledge, outcome) → release signature` |
| `server/escrow/anchor.mjs` | Path A implementation (Anchor program client) |
| `server/escrow/custody.mjs` | Path B implementation (SystemProgram transfers from keeper-custody wallet) |
| `server/replay.mjs` | Replay driver: streams captured real TxLINE payloads for the seeded historical fixture on a timer, tagged `source: "replay"`; emits the same internal events as `txline.mjs` so the keeper cannot tell the difference — and the final `game_finalised` still triggers a REAL devnet release |
| `server/events.mjs` | Internal event bus: fan-in from txline/replay/keeper, fan-out to SSE clients |

## 3. Data models (canonical types)

All money is **lamports as `BigInt`** in code and **decimal string** on the wire and on disk. Floats never touch money. SOL appears only in the UI formatting layer.

```ts
type PledgeState = "pending" | "condition_met" | "transferred" | "failed";
type FailureReason = "condition_not_met" | "transfer_error" | "fixture_cancelled";

type Condition =
  | { template: "team_wins";        params: { team: "home" | "away" } }
  | { template: "both_teams_score"; params: {} }
  | { template: "total_goals_gte";  params: { n: number } };   // integer ≥ 1

interface Pledge {
  id: string;                    // "plg_" + ulid
  fixtureId: number;
  condition: Condition;
  amountLamports: bigint;
  pledger: string;               // base58 pubkey
  beneficiary: string;           // base58 pubkey — preset charity wallet
  state: PledgeState;
  failureReason: FailureReason | null;
  createTx: string;              // signature, verified by escrow.confirmCreate
  releaseTx: string | null;      // signature once transferred (or returned)
  createdAt: string;             // ISO 8601 UTC
  updatedAt: string;
}

interface Fixture {
  fixtureId: number;
  home: string;
  away: string;
  kickoffUtc: string;
  status: "upcoming" | "live" | "finalised";
  source: "live" | "replay";
}

interface MatchStats {              // input to conditions.evaluate
  fixtureId: number;
  homeGoals: number;
  awayGoals: number;
  finalised: boolean;
}
```

State machine (the only lifecycle that exists):

```
pending ──(game_finalised + proof: condition true)──▶ condition_met ──(release tx confirmed)──▶ transferred
pending ──(game_finalised + proof: condition false → funds auto-returned to pledger)──▶ failed(condition_not_met)
pending ──(fixture cancelled)──▶ failed(fixture_cancelled)
condition_met ──(release tx errors after retries)──▶ failed(transfer_error)   // funds remain escrowed; manual ops note in docs
```

No Draft/Open/Locked/Void states, no claim/refund instructions or user actions — the condition-false return is performed automatically by the same keeper release path.

## 4. Error handling policy (no silent defaults)

- **A failed read is never a zero.** If a balance read, TxLINE fetch, or proof fetch fails, the operation surfaces an ERROR (thrown/logged/SSE `error` event), never a default value. The invariant totals endpoint returns HTTP 500 rather than fabricated numbers.
- **Idempotent resolution.** `keeper.resolve` and `POST /api/resolve/:id` check persisted state first; a pledge in `transferred`/`failed` returns its current record and performs no transfer. Release signature is persisted before state flips to `transferred`.
- **Proof-gated release.** No release transaction is ever sent without a successful TxLINE stat-validation check for that fixture. A missing/failed proof retries with backoff; it does not fall through to "assume true".
- **SSE resilience.** TxLINE SSE disconnects reconnect with backoff and resubscribe; missed `game_finalised` is covered by a polling sweep of unresolved pledges on finalised fixtures every 30s.
- **All lamport arithmetic is BigInt**; any float reaching a money path throws immediately.

## 5. Constraints (preflight facts)

- **TxLINE session:** token flow and session file already proven by `scripts/connect.mjs` (existence verified in masterplan validator table); free premium access ends July 19, 2026 23:59 UTC.
- **Anchor gate:** toolchain verified installed (solana-cli 3.1.10, anchor-cli 1.1.2). Path A proceeds only if `create_pledge` + `resolve` compile in the 30-min smoke test; otherwise `ESCROW_MODE=custody`, stated honestly.
- **Funds:** demo wallet 5.49792092 devnet SOL (verified). Devnet SOL only — no USDC, no tokens.
- **Judging window:** matches may be over during review — the replay driver is a first-class production feature, not a test fixture.
- **Deploy:** frontend is a static build; the keeper needs a real host (TxLINE credentials cannot live in a static frontend). Host decision per masterplan: locked at spec lock, skeleton deployed by 23:00 BST.
