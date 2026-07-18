# 03-API-SPEC — The decoupling contract

> **Track sentence (verbatim from archieve/tracks/track-02.md):** "Most fans watching the World Cup are doing it with a phone in their hand. TxLINE gives you live scores, real-time odds, and match events for all 104 games, the kind of data that until now only the big operators could access. We want to see what builders who are also fans do with it. The experiences that could exist here have not been built yet."
> **Persona (real fan):** Supavich — real fan, London hackathon builder. The group-chat promise nobody ever keeps: "if we win this one, I'll donate a tenner" — said every match, kept never. (Relatable anecdote, not a cited statistic.)
> **Wow moment:** Final whistle → keeper fires → SOL visibly moves + explorer link with Merkle proof — no human touched it.

**Rule: the frontend mock layer (`mock.ts`) is generated FROM this file.** If front and back disagree, this file is fixed first, then both sides. Wire conventions: all lamports are **decimal strings** (parsed to `bigint` at both boundaries — JSON numbers/floats never carry money); timestamps ISO 8601 UTC; pubkeys base58 strings; every error body is `{ "error": { "code": string, "message": string } }`.

## 1. Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/fixtures` | Fixture list (replay fixture + live fixtures if any) |
| GET | `/api/pledges` | The board: all pledges + invariant totals |
| POST | `/api/pledges` | Register a created (signed + sent) pledge for tracking |
| GET | `/api/pledges/:id` | One pledge |
| GET | `/api/stream` | SSE relay of match events + pledge updates |
| POST | `/api/resolve/:id` | Idempotent resolution backstop (keeper also auto-fires) |

## 2. Endpoint contracts (exact JSON shapes)

### Shared objects

```json
// Condition — exactly these three templates, nothing else
{ "template": "team_wins",        "params": { "team": "home" } }
{ "template": "both_teams_score", "params": {} }
{ "template": "total_goals_gte",  "params": { "n": 3 } }
```

```json
// Pledge
{
  "id": "plg_01J4XW8Z6K9QN2M5",
  "fixtureId": 104032,
  "condition": { "template": "team_wins", "params": { "team": "home" } },
  "amountLamports": "100000000",
  "pledger": "7fUAJdStEuGbc3sM84cKRL6yYaaSstyLSU4ve5oovLS7",
  "beneficiary": "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin",
  "state": "pending",
  "failureReason": null,
  "createTx": "5wHu1qwD4kKKyg1DAtUav21VVpYtCrcuTHtVXH9rRZScXY6VZJVzL2NfG7cUJzoxHqbSBTrHtCJPKQSbHWyRPHvj",
  "releaseTx": null,
  "createdAt": "2026-07-18T21:04:00Z",
  "updatedAt": "2026-07-18T21:04:00Z"
}
```

`state` ∈ `"pending" | "condition_met" | "transferred" | "failed"`.
`failureReason` ∈ `null | "condition_not_met" | "transfer_error" | "fixture_cancelled"`.

```json
// Fixture
{
  "fixtureId": 104032,
  "home": "Argentina",
  "away": "France",
  "kickoffUtc": "2026-07-18T19:00:00Z",
  "status": "live",
  "source": "replay"
}
```

`status` ∈ `"upcoming" | "live" | "finalised"`; `source` ∈ `"live" | "replay"` (frontend must badge `"replay"`).

### GET /api/fixtures

Response `200`:

```json
{ "fixtures": [ Fixture, ... ] }
```

Errors: `502 {"error":{"code":"txline_unavailable","message":"..."}}` — never an empty list on upstream failure.

### GET /api/pledges

Response `200` (totals are the live invariant readout; a failed balance read → `500 balance_read_failed`, never zeros):

```json
{
  "pledges": [ Pledge, ... ],
  "totals": {
    "depositedLamports": "300000000",
    "activeLamports": "100000000",
    "releasedLamports": "200000000"
  }
}
```

Invariant: `activeLamports + releasedLamports == depositedLamports`.

### POST /api/pledges

The frontend builds and sends the create transaction (via the escrow path's prepared instructions), then registers it here for tracking.

Request:

```json
{
  "fixtureId": 104032,
  "condition": { "template": "total_goals_gte", "params": { "n": 3 } },
  "amountLamports": "100000000",
  "pledger": "7fUAJdStEuGbc3sM84cKRL6yYaaSstyLSU4ve5oovLS7",
  "beneficiary": "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin",
  "createTx": "5wHu1qwD4kKK...PHvj"
}
```

Response `201`: the full `Pledge` object (state `"pending"`). The backend verifies `createTx` on-chain (correct lamports into the escrow destination) before accepting.

Errors:

| Status | code | When |
|---|---|---|
| 400 | `invalid_condition` | Unknown template, bad params (e.g. `n` < 1 or non-integer) |
| 400 | `invalid_amount` | Not a positive integer decimal string |
| 400 | `invalid_pubkey` | Pledger/beneficiary not valid base58 |
| 404 | `fixture_not_found` | Unknown `fixtureId` |
| 409 | `duplicate_create_tx` | `createTx` already registered (idempotency) |
| 422 | `fixture_already_finalised` | Fixture no longer accepts pledges |
| 422 | `create_tx_invalid` | Signature not found on-chain or lamports/destination mismatch |

### GET /api/pledges/:id

Response `200`: `Pledge`. Error `404 {"error":{"code":"not_found","message":"..."}}`.

### GET /api/stream (SSE)

`Content-Type: text/event-stream`. Named events, each `data:` a single JSON object:

```
event: score
data: {"fixtureId":104032,"homeGoals":1,"awayGoals":0,"minute":34,"source":"replay"}

event: match_event
data: {"fixtureId":104032,"type":"goal","team":"home","minute":34,"detail":"Goal — Argentina","source":"replay"}

event: pledge_update
data: { ...full Pledge object... }

event: game_finalised
data: {"fixtureId":104032,"homeGoals":2,"awayGoals":1,"source":"replay"}

event: heartbeat
data: {"ts":"2026-07-18T21:05:00Z"}
```

`match_event.type` ∈ `"goal" | "red_card" | "kickoff" | "half_time" | "full_time"`. Heartbeat every 15s. Clients reconnect with `EventSource` default behavior; the board re-fetches `GET /api/pledges` on reconnect.

### POST /api/resolve/:id

Idempotent backstop — the keeper auto-fires resolution on `game_finalised`; this endpoint forces a resolution sweep for one pledge (ops/demo safety, not a UI step). Empty request body.

Response `200`: the full `Pledge` in its post-resolution state. Calling it on an already-`transferred`/`failed` pledge returns the current record unchanged — never a second transfer.

Errors:

| Status | code | When |
|---|---|---|
| 404 | `not_found` | Unknown pledge id |
| 409 | `fixture_not_finalised` | Fixture still `upcoming`/`live` — resolution refuses to run early |
| 502 | `proof_unavailable` | TxLINE stat-validation fetch failed; state unchanged, keeper will retry |

## 3. State machine (single source of truth; 02 and 04 mirror this)

```
pending ──(game_finalised + Merkle proof: condition TRUE)──▶ condition_met
condition_met ──(release tx confirmed on devnet)──▶ transferred
pending ──(game_finalised + proof: condition FALSE; funds auto-returned)──▶ failed(condition_not_met)
pending ──(fixture cancelled)──▶ failed(fixture_cancelled)
condition_met ──(release tx failed after retries)──▶ failed(transfer_error)
```

Terminal states: `transferred`, `failed`. Every transition emits an SSE `pledge_update`. There are no other states and no user-driven transitions after create.

## 4. Contract discipline

- `src/lib/mock.ts` implements every endpoint and SSE event above with seeded data and a scripted replay timeline (04 §5).
- Any shape change lands here first, in one commit, before either side adapts.
- The backend integration tests (07 tier 2) and the frontend contract tests (08 tier 2) both assert against the shapes in this file.
