# Build Bugs — Code-Level Findings

These are implementation bugs identified during requirements review. They are not requirements gaps — the req is correct in each case; the code violates it.

---

## BUG-01: Halftime mapped to finalised

**File:** `server/txline.mjs`
**Severity:** Critical — tonight-on-camera risk

`GameState=3` is mapped to "finalised" and triggers resolution. TxLINE phase 3 = halftime, not full time. A live match would resolve at the break with incomplete stats, causing a false payout or a failed proof.

**Correct signal:** `action=game_finalised` from the SSE stream, with `statusId=100` and `period=100`.

**Req reference:** FR-6.2 — "resolution must only be possible after TxLINE confirms the match as finalised." Requirement is correct; code violates it.

---

## BUG-02: `seq ?? 0` — proof requests always use sequence 0

**File:** `server/keeper.mjs` (or equivalent keeper file)
**Severity:** Critical — resolves can never complete

The keeper defaults the TxLINE sequence number to `0` when `seq` is missing or falsy (`seq ?? 0`). TxLINE documents `seq=0` as always invalid — every proof request sent with this value will fail validation, making programmatic resolution impossible.

**Correct behaviour:** Read the sequence number from the `game_finalised` event payload or the `/api/scores/stat-validation` response. Never default to `0`.

**Req reference:** FR-6.3 — "resolution must use TxLINE's on-chain cryptographic proof to verify the condition." Requirement is correct; code violates it.

---

## BUG-03: False winners flash — `condition_met` emitted before evaluation

**File:** Keeper / feed emitter
**Severity:** High — bad UX for losing pledgers on camera

The keeper emits `condition_met` before evaluating the proof, so every pledge briefly appears successful in the live settlement feed immediately after `game_finalised` fires. Losing pledges then silently flip back once evaluation completes.

**Correct behaviour:** Emit `condition_met` only after the proof has been evaluated and the resolve transaction has landed on-chain successfully.

**Req reference:** FR-10.1 — "the system must surface resolution events in real time as they occur on-chain." Feed events must reflect confirmed on-chain state, not speculative pre-evaluation state.

---

## BUG-04: Live SSE never wired — boot defaults to replay

**File:** Keeper boot sequence
**Severity:** Critical — keeper never fires on live matches

`subscribeScores` exists but is never called at startup. The keeper boots into replay mode by default, producing no `game_finalised` event for a live match. Resolution never triggers.

**Correct behaviour:** Call `subscribeScores` in the boot sequence. Replay should be a dev-only flag, not the default.

**Req reference:** FR-13.1 — "the keeper must subscribe to TxLINE's SSE stream as its primary signal for `game_finalised` events." Currently unimplemented.

---
