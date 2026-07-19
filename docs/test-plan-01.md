# Test Plan — Social Commitment Engine (TIFO)

Scope: what must be verified before the demo is recorded and the repo goes public. Ordered by payoff-per-minute — this is a hackathon test plan, not a production one. Anything marked **[GATE]** blocks demo recording.

---

## 1. On-chain program (Anchor + `anchor test` against local validator with cloned TxLINE program, or devnet)

Bankrun/litesvm is preferred for speed; devnet integration for the CPI paths (the TxLINE program cannot be trivially mocked — validating against the real devnet deployment is both easier and more convincing).

### 1.1 `create_commitment`
- [ ] **[GATE]** Happy path: account initialised, founder is `members[0]`, vault funded, event emitted
- [ ] Rejects `condition_template` ∉ {0,1}; rejects TeamWins `condition_param` ∉ {0,1}
- [ ] Rejects `kickoff_ts` in the past; rejects deposit < 0.01 SOL
- [ ] Account size: 500-member allocation succeeds and rent estimate (~0.15 SOL) is right

### 1.2 `join` / `withdraw`
- [ ] **[GATE]** Join before kickoff adds member + funds vault; join at/after `kickoff_ts` fails `KickoffPassed` (warp clock)
- [ ] Rejoin after withdraw fails; duplicate join fails `AlreadyMember`; member 501 fails `MemberLimitReached` (unit-test the slot-scan with a small-N build flag if 500 is too slow to fill)
- [ ] Withdraw returns exact deposit; last-member withdraw → `Closed`, and every instruction on a Closed commitment fails
- [ ] Withdraw at/after kickoff fails `KickoffPassed`

### 1.3 `resolve` (the pipeline that wins or loses the hackathon)
- [ ] **[GATE]** YES path with real devnet proof (replay fixture `18241006`, BTTS): status → `Executed`, full vault lands on beneficiary *in the same tx*, event emitted
- [ ] **[GATE]** NO path (TeamWins for the losing side on the same fixture): status → `Refunded`, vault untouched
- [ ] Second resolve on a settled commitment fails `NotOpen` with zero side effects (idempotency — keeper FR-13.5 depends on this)
- [ ] Tampered proof / wrong `seq` / wrong `dailyScoresPda` all fail — assert the CPI error propagates, funds unmoved

### 1.4 `claim_refund`
- [ ] Pro-rata amounts exact for uneven deposits; double-claim fails; non-member fails
- [ ] **[GATE]** Last claimer closes vault and receives rent reserve
- [ ] Claim works from both `Refunded` and `Void`; fails from `Open`/`Executed`

### 1.5 `void_fixture` / `void_timeout`
- [ ] `void_fixture` only accepts proof with `gameState == 16`; a `gameState == 6` (WaitET) proof must fail `FixtureNotCancelled` — regression test for the doc bug fixed on 2026-07-18
- [ ] `void_timeout` fails before kickoff+7d (warp), succeeds after, member-only

---

## 2. Keeper

Run against replay fixture `18241006` unless noted.

- [ ] **[GATE]** Replay end-to-end: boot with `REPLAY_FIXTURE_ID` → historical fetch → proof → resolve tx confirms → feed event emitted *after* confirmation (BUG-03 regression)
- [ ] **[GATE]** Boot sequence calls `subscribeScores` when `REPLAY_FIXTURE_ID` unset (BUG-04 regression — assert SSE connection opened in logs)
- [ ] Ignores `statusId != 100` and non-`game_finalised` actions (BUG-01 regression — feed a halftime record through the poll path)
- [ ] Missing `seq` → error logged, no proof fetch with `seq=0` ever issued (BUG-02 regression — assert on outbound request params)
- [ ] `epochDay` for `dailyScoresPda` derived from proof `minTimestamp`, not wall clock (assert on a fixture from a previous day)
- [ ] SSE kill mid-run → poll still detects finalisation within one poll interval; duplicate delivery (SSE + poll) resolves once (`resolvedFixtures` set)
- [ ] Proof fetch 500 → backoff ×3 → picked up on next cycle
- [ ] Already-resolved tx error treated as success, no retry loop

## 3. Indexer

- [ ] Every program event maps to the right row mutation (fire each once, assert DB)
- [ ] Kill listener during activity → reconciliation scan corrects state within 10 min (or on manual trigger)
- [ ] `/api/claims?wallet=` returns exactly unclaimed+unwithdrawn rows on Refunded/Void commitments
- [ ] Board sort/filter params hit indexes (EXPLAIN once, move on)

## 4. Frontend (manual pass, ~45 min, run twice: desktop + phone width)

Happy paths are covered by recording the demo itself. Verify the states the video won't show:
- [ ] Board with no wallet: everything readable, zero connect prompts (FR-9.1/FR-11.3)
- [ ] Wizard validation: bad address, sub-minimum amount, wallet-reject mid-sign (toast "cancelled", no stuck state)
- [ ] Join/withdraw buttons genuinely disappear at kickoff (client) AND the program rejects a raced tx (server truth)
- [ ] NO-path banner + claim + ClaimsBadge lifecycle with a second wallet
- [ ] Kill indexer → amber banner, cached board; kill keeper SSE → "reconnecting…" chip
- [ ] `prefers-reduced-motion`: ceremony collapses to crossfade
- [ ] Demo mode: every status chip variant visible on the seeded board

## 5. Pre-recording dress rehearsal **[GATE]**

Full run of the demo script (`docs/submission-01.md` §3) on fresh wallets, replay fixture, screen-recorded as a throwaway. If any beat requires an off-camera hand (manual db poke, service restart), fix or re-script before the real take. Budget: one hour, no later than 3 hours before the local deadline (Jul 19 12:00 BST).
