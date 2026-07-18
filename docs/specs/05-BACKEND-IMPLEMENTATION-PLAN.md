# 05-BACKEND-IMPLEMENTATION-PLAN

> **Track sentence (verbatim from archieve/tracks/track-02.md):** "Most fans watching the World Cup are doing it with a phone in their hand. TxLINE gives you live scores, real-time odds, and match events for all 104 games, the kind of data that until now only the big operators could access. We want to see what builders who are also fans do with it. The experiences that could exist here have not been built yet."
> **Persona (real fan):** Supavich — real fan, London hackathon builder. The group-chat promise nobody ever keeps: "if we win this one, I'll donate a tenner" — said every match, kept never. (Relatable anecdote, not a cited statistic.)
> **Wow moment:** Final whistle → keeper fires → SOL visibly moves + explorer link with Merkle proof — no human touched it.

## 1. Parallel tracks — genuinely file-independent

No track touches another track's files. Shared types and the escrow interface land in Foundation before any track starts, so tracks only ever import — never edit — each other's surface.

### Foundation (sequential, before the tracks fan out)

| Task | Files | Notes |
|---|---|---|
| F1. Anchor smoke test (30-min hard box) | `program/` (throwaway if it fails) | `create_pledge` + `resolve` compile & deploy to devnet in 30 min → `ESCROW_MODE=anchor`; else custody, stated honestly. **This runs FIRST, not last** (masterplan risk #1) |
| F2. Scaffold + types + store | `server/index.mjs`, `server/types.mjs`, `server/store.mjs`, `server/events.mjs` | Canonical types from 02 §3; bigint-safe JSON snapshot; internal event bus |
| F3. Escrow interface + both impls | `server/escrow/interface.mjs`, `server/escrow/custody.mjs`, `server/escrow/anchor.mjs` | Custody impl is ~50 lines (SystemProgram); anchor impl only if F1 passed. One env switch, per 02 §1 |

### Track A — pure condition-evaluation logic

| Task | Files |
|---|---|
| A1. `evaluate(condition, stats)` for the 3 templates | `server/conditions.mjs` |
| A2. `progress(condition, stats)` plain-English progress strings | `server/conditions.mjs` |
| A3. Unit tests incl. edge cases (0–0 both_teams_score, exact-n total_goals_gte, away win) | `server/conditions.test.mjs` |

### Track B — TxLINE client + keeper loop

| Task | Files |
|---|---|
| B1. TxLINE client: session auth (reuse `scripts/connect.mjs` pattern, `_keys/txline-session.json`), fixtures fetch, scores/events SSE subscribe, stat-validation proof fetch — host `https://txline-dev.txodds.com` | `server/txline.mjs` |
| B2. Capture real payloads for the seeded historical fixture into `server/fixtures/replay-data.json` | `server/fixtures/replay-data.json` (data), `server/scripts/capture.mjs` |
| B3. Replay driver emitting identical internal events, tagged `source:"replay"` | `server/replay.mjs` |
| B4. Keeper loop: `game_finalised` → proof fetch → `conditions.evaluate` → `escrow.release` → state transition + `pledge_update`; idempotent; 30s sweep for missed finals | `server/keeper.mjs` |

### Track C — REST endpoints + SSE relay

| Task | Files |
|---|---|
| C1. `GET /api/fixtures`, `GET /api/pledges` (+ invariant totals), `GET /api/pledges/:id` per 03 shapes | `server/routes.mjs` |
| C2. `POST /api/pledges` with on-chain createTx verification + all 03 error codes | `server/routes.mjs` |
| C3. `GET /api/stream` SSE relay off the event bus (heartbeat 15s) + `POST /api/resolve/:id` idempotent backstop | `server/routes.mjs` |
| C4. API tests with mocked TxLINE + mocked escrow | `server/routes.test.mjs` |

Cross-track contract: A exposes `evaluate`/`progress`; B consumes A and Foundation's escrow interface; C consumes only `store` + `events` + escrow interface. Where B4 needs A before A is merged, B stubs `evaluate` behind the same import path in its test file only — never in product code.

## 2. Execution map

```
F1 (Anchor smoke, 30 min, FIRST) ──┐
F2 (scaffold/types/store)          ├─▶ Tracks A, B, C run in parallel
F3 (escrow interface + impls) ─────┘
A1→A2→A3      (pure logic — fastest, no credentials)
B1→B2→B3→B4   (B2/B3 can interleave with B1)
C1→C2→C3→C4
Integration: keeper end-to-end on replay data (B4 + A + F3 + C3 together) — the wow-moment rehearsal
Deploy skeleton (backend host + static frontend) by 23:00 BST per masterplan
```

## 3. Definition of done (per task)

Test green + committed. No task is "done" on a diff alone: run the task's test (or for B1, a live one-shot fetch against the real TxLINE devnet host) and commit with the passing output in the commit body. Integration milestone done = full replay run ends in a REAL devnet transfer with an explorer link printed to the log.
