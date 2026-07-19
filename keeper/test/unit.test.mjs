import { test } from 'node:test';
import assert from 'node:assert/strict';
import BN from 'bn.js';

import {
  epochDayFromMinTimestamp,
  isCancelledGameState,
  isFinalisedEvent,
  mapStatValidation,
  scoreUpdateUrls,
  statKeysForTemplate,
  unpackFixtureId,
  windowStartDayFromEpochDay,
  GAME_STATE_SHIFT,
} from '../src/mapping.mjs';

const hash = (fill) => new Array(32).fill(fill);

// Sample REST response in the txline-boilerplate.md shape.
function sampleValidation(overrides = {}) {
  const minTimestamp = 20649 * 86_400_000 + 5_000; // mid-day on epoch day 20649
  return {
    summary: {
      fixtureId: 18241006,
      updateStats: { updateCount: 42, minTimestamp, maxTimestamp: minTimestamp + 7_200_000 },
      eventStatsSubTreeRoot: hash(9),
    },
    subTreeProof: [{ hash: hash(1), isRightSibling: true }],
    mainTreeProof: [
      { hash: hash(2), isRightSibling: false },
      { hash: hash(3), isRightSibling: true },
    ],
    eventStatRoot: hash(4),
    statsToProve: [
      { key: 1, value: 2, period: 100 },
      { key: 2, value: 1, period: 100 },
    ],
    statProofs: [
      [{ hash: hash(11), isRightSibling: false }],
      [{ hash: hash(22), isRightSibling: true }],
    ],
    ...overrides,
  };
}

test('mapStatValidation: proof JSON → StatValidationInput shape', () => {
  const val = sampleValidation();
  const { payload, epochDay } = mapStatValidation(val);

  // i64 fields are BN
  assert.ok(BN.isBN(payload.ts));
  assert.ok(payload.ts.eq(new BN(val.summary.updateStats.minTimestamp)));
  assert.ok(payload.fixtureSummary.fixtureId.eq(new BN(18241006)));
  assert.ok(BN.isBN(payload.fixtureSummary.updateStats.minTimestamp));
  assert.ok(BN.isBN(payload.fixtureSummary.updateStats.maxTimestamp));
  // i32 stays a plain number
  assert.equal(payload.fixtureSummary.updateStats.updateCount, 42);

  // hashes become plain number arrays
  assert.deepEqual(payload.fixtureSummary.eventsSubTreeRoot, hash(9));
  assert.deepEqual(payload.eventStatRoot, hash(4));
  assert.equal(payload.fixtureProof.length, 1);
  assert.equal(payload.mainTreeProof.length, 2);
  assert.deepEqual(payload.fixtureProof[0], { hash: hash(1), isRightSibling: true });

  // statsToProve[i] pairs with statProofs[i]
  assert.equal(payload.stats.length, 2);
  assert.deepEqual(payload.stats[0].stat, { key: 1, value: 2, period: 100 });
  assert.deepEqual(payload.stats[0].statProof, [{ hash: hash(11), isRightSibling: false }]);
  assert.deepEqual(payload.stats[1].stat, { key: 2, value: 1, period: 100 });
  assert.deepEqual(payload.stats[1].statProof, [{ hash: hash(22), isRightSibling: true }]);

  // epochDay derived from the proof's minTimestamp, not wall clock
  assert.equal(epochDay, 20649);
});

test('mapStatValidation: keys normalised to [1,2] with proofs kept paired', () => {
  const val = sampleValidation({
    statsToProve: [
      { key: 2, value: 1, period: 100 },
      { key: 1, value: 2, period: 100 },
    ],
    statProofs: [
      [{ hash: hash(22), isRightSibling: true }], // belongs to key 2
      [{ hash: hash(11), isRightSibling: false }], // belongs to key 1
    ],
  });
  const { payload } = mapStatValidation(val);
  assert.equal(payload.stats[0].stat.key, 1);
  assert.deepEqual(payload.stats[0].statProof[0].hash, hash(11));
  assert.equal(payload.stats[1].stat.key, 2);
  assert.deepEqual(payload.stats[1].statProof[0].hash, hash(22));
});

test('mapStatValidation: rejects non-final periods (program enforces period=100)', () => {
  const val = sampleValidation({
    statsToProve: [
      { key: 1, value: 1, period: 100 },
      { key: 2, value: 0, period: 3 }, // halftime-ish snapshot — must be refused
    ],
  });
  assert.throws(() => mapStatValidation(val), /period 3/);
});

test('mapStatValidation: rejects wrong stat keys', () => {
  const val = sampleValidation({
    statsToProve: [
      { key: 1, value: 1, period: 100 },
      { key: 5, value: 0, period: 100 },
    ],
  });
  assert.throws(() => mapStatValidation(val), /keys \[1,2\]/);
});

test('epochDay derivation from minTimestamp', () => {
  assert.equal(epochDayFromMinTimestamp(20649 * 86_400_000), 20649);
  assert.equal(epochDayFromMinTimestamp(20649 * 86_400_000 + 86_399_999), 20649);
  assert.equal(epochDayFromMinTimestamp(20650 * 86_400_000), 20650);
  assert.equal(windowStartDayFromEpochDay(20655), 20650);
  assert.equal(windowStartDayFromEpochDay(20650), 20650);
  assert.equal(windowStartDayFromEpochDay(20649), 20640);
});

test('gameState unpacking: 16 = Cancelled voids, 6 = WaitET must not', () => {
  const pureId = 18241006;

  const cancelled = unpackFixtureId(16 * GAME_STATE_SHIFT + pureId);
  assert.equal(cancelled.gameState, 16);
  assert.equal(cancelled.fixtureId, pureId);
  assert.equal(isCancelledGameState(cancelled.gameState), true);

  const waitEt = unpackFixtureId(6 * GAME_STATE_SHIFT + pureId);
  assert.equal(waitEt.gameState, 6);
  assert.equal(waitEt.fixtureId, pureId);
  assert.equal(isCancelledGameState(waitEt.gameState), false);

  // unpacked (no state bits) fixture id passes through untouched
  const plain = unpackFixtureId(pureId);
  assert.equal(plain.gameState, 0);
  assert.equal(plain.fixtureId, pureId);
});

test('interval scan URL generation: last 24 five-minute windows', () => {
  // 2026-07-18 21:13:00 UTC → interval 2 of hour 21
  const nowMs = Date.UTC(2026, 6, 18, 21, 13, 0);
  const epochDay = Math.floor(nowMs / 86_400_000);
  const urls = scoreUpdateUrls(nowMs, 24);

  assert.equal(urls.length, 24);
  assert.equal(urls[0], `/scores/updates/${epochDay}/21/2`);
  assert.equal(urls[1], `/scores/updates/${epochDay}/21/1`);
  assert.equal(urls[2], `/scores/updates/${epochDay}/21/0`);
  // crosses the hour boundary: 21:13 − 15min = 20:58 → hour 20, interval 11
  assert.equal(urls[3], `/scores/updates/${epochDay}/20/11`);
  // 23 windows back: 21:13 − 115min = 19:18 → hour 19, interval 3
  assert.equal(urls[23], `/scores/updates/${epochDay}/19/3`);

  // crossing a UTC day boundary rolls the epochDay back too
  const midnight = Date.UTC(2026, 6, 18, 0, 2, 0);
  const dayOf = Math.floor(midnight / 86_400_000);
  const urlsAtMidnight = scoreUpdateUrls(midnight, 2);
  assert.equal(urlsAtMidnight[0], `/scores/updates/${dayOf}/0/0`);
  assert.equal(urlsAtMidnight[1], `/scores/updates/${dayOf - 1}/23/11`);
});

test('game_finalised filter (BUG-01): only action=game_finalised with statusId=100', () => {
  assert.equal(isFinalisedEvent({ action: 'game_finalised', statusId: 100 }), true);
  // intermediate states must never fire
  assert.equal(isFinalisedEvent({ action: 'game_finalised', statusId: 30 }), false);
  assert.equal(isFinalisedEvent({ action: 'game_finalised', statusId: 99 }), false);
  assert.equal(isFinalisedEvent({ action: 'goal', statusId: 100 }), false);
  assert.equal(isFinalisedEvent({ action: 'halftime', statusId: 3 }), false);
  assert.equal(isFinalisedEvent({ action: 'game_finalised' }), false); // missing statusId
  assert.equal(isFinalisedEvent(null), false);
  assert.equal(isFinalisedEvent(undefined), false);
});

test('statKeysForTemplate: goals vs pens', () => {
  assert.deepEqual(statKeysForTemplate(0), [1, 2]);
  assert.deepEqual(statKeysForTemplate(1), [1, 2]);
  assert.deepEqual(statKeysForTemplate(5), [1, 2]);
  assert.deepEqual(statKeysForTemplate(6), [6001, 6002]);
  assert.deepEqual(statKeysForTemplate(7), [6001, 6002]);
});
