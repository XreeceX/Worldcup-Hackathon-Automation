// Pure helpers: proof-JSON → Anchor payload mapping, epoch-day / PDA math,
// packed fixture-id decoding, interval-scan URLs and event filtering.
// Everything here is unit-tested in test/unit.test.mjs.

import BN from 'bn.js';

export const TXORACLE_PROGRAM_ID = '6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J';

/** gameState is packed into the top 16 bits of the fixture id (2^48 shift). */
export const GAME_STATE_SHIFT = 281474976710656; // 2^48
/** 16 = Cancelled. 6 is WaitET (extra time pending) and must NEVER void. */
export const GAME_STATE_CANCELLED = 16;
/** TxLINE marks a fully finalised score record with period/statusId 100. */
export const FINAL_PERIOD = 100;

/** Goals [1,2] for FT (ET included); shootout [6001,6002] for pen templates. */
export function statKeysForTemplate(template) {
  const t = Number(template);
  if (t === 6 || t === 7) return [6001, 6002];
  return [1, 2];
}

/** BUG-01 fix: only a game_finalised action with statusId 100 counts. */
export function isFinalisedEvent(data) {
  return data?.action === 'game_finalised' && data?.statusId === 100;
}

/** CRITICAL: epoch day comes from the proof's minTimestamp, never Date.now(). */
export function epochDayFromMinTimestamp(minTimestampMs) {
  return Math.floor(minTimestampMs / 86_400_000);
}

/** ten_daily_fixtures_roots PDAs cover 10-day windows. */
export function windowStartDayFromEpochDay(epochDay) {
  return Math.floor(epochDay / 10) * 10;
}

export function unpackFixtureId(packedId) {
  return {
    gameState: Math.floor(packedId / GAME_STATE_SHIFT),
    fixtureId: packedId % GAME_STATE_SHIFT,
  };
}

export function isCancelledGameState(gameState) {
  return gameState === GAME_STATE_CANCELLED;
}

/**
 * URLs for the polling fallback (design §7.4): the last `count` five-minute
 * windows of /scores/updates/{epochDay}/{hour}/{interval}, newest first.
 */
export function scoreUpdateUrls(nowMs, count = 24) {
  const urls = [];
  for (let i = 0; i < count; i++) {
    const t = new Date(nowMs - i * 300_000);
    const epochDay = Math.floor(t.getTime() / 86_400_000);
    const hour = t.getUTCHours();
    const interval = Math.floor(t.getUTCMinutes() / 5);
    urls.push(`/scores/updates/${epochDay}/${hour}/${interval}`);
  }
  return urls;
}

export function fixtureUpdatesUrl(nowMs) {
  const epochDay = Math.floor(nowMs / 86_400_000);
  const hour = new Date(nowMs).getUTCHours();
  return `/fixtures/updates/${epochDay}/${hour}`;
}

const mapProof = (arr) =>
  (arr ?? []).map((n) => ({ hash: Array.from(n.hash), isRightSibling: n.isRightSibling }));

/**
 * REST /scores/stat-validation JSON → Anchor StatValidationInput
 * (txline-boilerplate.md §validateStatV2 Step 2). i64 fields become BN,
 * hashes become number arrays, statsToProve[i] pairs with statProofs[i].
 *
 * The program pins the proof to the template's stat keys in order and period 100 —
 * we enforce the same here so a bad proof fails loudly before any tx is sent.
 */
export function mapStatValidation(val, expectedKeys = [1, 2]) {
  const stats = (val.statsToProve ?? []).map((stat, i) => ({
    stat: { key: stat.key, value: stat.value, period: stat.period },
    statProof: mapProof(val.statProofs?.[i]),
  }));
  // Keep each stat paired with its own proof while normalising key order.
  stats.sort((a, b) => a.stat.key - b.stat.key);

  const keys = stats.map((s) => s.stat.key);
  const exp = expectedKeys.map(Number);
  if (keys.length !== 2 || keys[0] !== exp[0] || keys[1] !== exp[1]) {
    throw new Error(
      `stat-validation proof must cover keys [${exp.join(',')}]; got [${keys.join(',')}]`,
    );
  }
  const badPeriod = stats.find((s) => s.stat.period !== FINAL_PERIOD);
  if (badPeriod) {
    throw new Error(
      `stat-validation proof is not final: stat key ${badPeriod.stat.key} has period ${badPeriod.stat.period}, expected ${FINAL_PERIOD}`
    );
  }

  const minTimestamp = val.summary.updateStats.minTimestamp;
  const payload = {
    ts: new BN(minTimestamp),
    fixtureSummary: {
      fixtureId: new BN(val.summary.fixtureId),
      updateStats: {
        updateCount: val.summary.updateStats.updateCount,
        minTimestamp: new BN(minTimestamp),
        maxTimestamp: new BN(val.summary.updateStats.maxTimestamp),
      },
      eventsSubTreeRoot: Array.from(val.summary.eventStatsSubTreeRoot),
    },
    fixtureProof: mapProof(val.subTreeProof),
    mainTreeProof: mapProof(val.mainTreeProof),
    eventStatRoot: Array.from(val.eventStatRoot),
    stats,
  };

  return { payload, epochDay: epochDayFromMinTimestamp(minTimestamp) };
}

// TxLINE feed records use PascalCase in some payloads and camelCase in
// others; pick the first defined spelling.
const pick = (obj, ...names) => {
  for (const n of names) if (obj?.[n] !== undefined) return obj[n];
  return undefined;
};

/**
 * REST /fixtures/validation JSON → args for void_fixture:
 * { snapshot: Fixture, summary: FixtureBatchSummary, subTreeProof, mainTreeProof }.
 */
export function mapFixtureValidation(val) {
  const f = val.snapshot ?? val.fixture;
  const s = val.summary;

  const snapshot = {
    ts: new BN(pick(f, 'ts', 'Ts')),
    startTime: new BN(pick(f, 'startTime', 'StartTime')),
    competition: pick(f, 'competition', 'Competition'),
    competitionId: pick(f, 'competitionId', 'CompetitionId'),
    fixtureGroupId: pick(f, 'fixtureGroupId', 'FixtureGroupId'),
    participant1Id: pick(f, 'participant1Id', 'Participant1Id'),
    participant1: pick(f, 'participant1', 'Participant1'),
    participant2Id: pick(f, 'participant2Id', 'Participant2Id'),
    participant2: pick(f, 'participant2', 'Participant2'),
    fixtureId: new BN(pick(f, 'fixtureId', 'FixtureId')),
    participant1IsHome: pick(f, 'participant1IsHome', 'Participant1IsHome'),
  };

  const minTimestamp = s.updateStats.minTimestamp;
  const summary = {
    fixtureId: new BN(s.fixtureId),
    competitionId: s.competitionId,
    competition: s.competition,
    updateStats: {
      updateCount: s.updateStats.updateCount,
      minTimestamp: new BN(minTimestamp),
      maxTimestamp: new BN(s.updateStats.maxTimestamp),
    },
    updateSubTreeRoot: Array.from(s.updateSubTreeRoot),
  };

  return {
    snapshot,
    summary,
    subTreeProof: mapProof(val.subTreeProof),
    mainTreeProof: mapProof(val.mainTreeProof),
    epochDay: epochDayFromMinTimestamp(minTimestamp),
  };
}
