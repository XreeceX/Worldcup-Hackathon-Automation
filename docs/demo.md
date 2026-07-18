# Demo Guide — Social Commitment Engine

## Replay Mode

The demo must not depend on a live match occurring at the right moment. Replay mode substitutes a historical fixture for the live SSE stream, allowing the full proof pipeline to be exercised on demand.

### How it works

- Set `REPLAY_FIXTURE_ID=<id>` in the environment. When set, the keeper skips live SSE subscription and instead polls `/api/scores/historical/<fixtureId>` to retrieve a finalised score record.
- The historical endpoint returns real `seq`, `statusId`, and `action` values from a completed match — the proof pipeline runs identically to live mode.
- The frontend receives the same events via the keeper's internal event bus; no frontend changes are needed to switch modes.

### Choosing a replay fixture

- Use a completed World Cup fixture where the condition being demoed is clearly met (e.g. a match where both teams scored, or a team won on goals).
- Confirm the fixture has a finalised record with `action=game_finalised` and `statusId=100` before recording the demo.
- Note the `seq` from the historical record — use this exact value when fetching the stat-validation proof.

### Switching modes

| Mode | Environment variable | Keeper behaviour |
|---|---|---|
| Live | `REPLAY_FIXTURE_ID` unset | Subscribes to `/scores/stream` SSE |
| Replay | `REPLAY_FIXTURE_ID=<id>` | Polls `/scores/historical/<id>` |

---

## Submission Checklist

Complete every item before recording the demo video.

### Proof pipeline

- [ ] Keeper subscribes to `/scores/stream` SSE at boot (not just replay)
- [ ] `seq` is read from a real score record — never defaults to `0`
- [ ] Stat-validation proof is fetched with the correct `seq` and `statKeys`
- [ ] `epochDay` is derived from `val.summary.updateStats.minTimestamp`, not `Date.now()`
- [ ] `dailyScoresPda` is derived from the proof's `epochDay`, not wall-clock
- [ ] Resolution only triggers on `action=game_finalised` / `statusId=100` — not on intermediate states (e.g. halftime / `statusId` < 100)
- [ ] `condition_met` event is emitted only after the resolve transaction confirms on-chain

### On-chain program

- [ ] Commitment account stores: fixture ID, kickoff timestamp, condition (template + params), beneficiary, members, vault balance, status
- [ ] `join` instruction rejects if `Clock::get().unix_timestamp >= kickoff_timestamp`
- [ ] `resolve` verifies proof via `validateStatV2` CPI — does not accept a caller-supplied boolean
- [ ] YES path: vault transferred to beneficiary atomically in the resolve transaction
- [ ] NO path: commitment marked REFUNDED; `claim_refund` available per member
- [ ] `claim_refund` for last member closes vault account and transfers rent reserve to that member

### Frontend

- [ ] Wallet adapter integrated (Phantom, Solflare, Backpack)
- [ ] Public board loads without wallet connection
- [ ] Create commitment flow requires connected wallet
- [ ] In-play pledge card shows live score and condition status without page refresh
- [ ] Live settlement feed updates in real time on resolution
- [ ] "Wins on goals (extra time counts; penalty shootout excluded)" disclosed at condition selection for "Team wins" template

### Demo flow (record in this order)

1. Connect wallet
2. Select an upcoming (or replay) fixture
3. Create an individual commitment — choose condition, set beneficiary, deposit
4. Confirm commitment appears on public board
5. (If DAO demo) Create group commitment; join with a second wallet
6. Trigger resolution (live or replay)
7. Show YES path: beneficiary receives funds; settlement feed updates; explorer link works
8. Show NO path: commitment enters REFUNDED; claim refund as member
