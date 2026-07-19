import type { Fixture } from './types';
import {
  enrichFixtureMeta,
  isKnockoutStage,
  stageForFixtureId,
} from './wcSchedule';

/** Longest plausible match window (ET + shootout + stoppages) — mirrors indexer. */
export const MATCH_WINDOW_MS = 3.5 * 60 * 60 * 1000;

/** Earliest plausible full-time after kickoff (90' + stoppage buffer). */
export const EST_FULL_TIME_MS = 105 * 60 * 1000;

/** After FT, keep pledge settlement in "results pending" for this long. */
export const PLEDGE_RESULTS_PENDING_MS = 25 * 60 * 1000;

export type FixtureBucket = 'upcoming' | 'live' | 'finished';

const FINISHED_GAME_STATES = new Set([5, 10, 13, 15, 16, 100]);

/**
 * Past / live / upcoming from fixture metadata.
 * Do NOT trust a derived `status` string alone — indexer often leaves game_state
 * at 0 after FT, which previously kept matches "live" for the full 3.5h window.
 * Explicit in-play game states (H1/HT/H2/ET) stay live; NS/unknown uses est. FT.
 */
export function fixtureBucket(
  fixture: Pick<Fixture, 'gameState' | 'kickoffTs' | 'status'>,
  nowMs = Date.now(),
): FixtureBucket {
  const gs = Number(fixture.gameState);
  if (FINISHED_GAME_STATES.has(gs)) return 'finished';
  // Trust explicit in-play states (extra time, pens, etc.).
  if (Number.isFinite(gs) && gs >= 2) return 'live';

  const kickoff = Number(fixture.kickoffTs);
  if (Number.isFinite(kickoff) && kickoff > 0) {
    if (kickoff > nowMs) return 'upcoming';
    // Stale NS (0/1): after regulation FT, treat as finished — matches Match Centre.
    if (nowMs - kickoff >= EST_FULL_TIME_MS) return 'finished';
    return 'live';
  }

  if (fixture.status === 'finished') return 'finished';
  if (fixture.status === 'upcoming') return 'upcoming';
  if (fixture.status === 'live') return 'live';
  return 'finished';
}

/** True when the match is over (fixture metadata and/or live score). */
export function isMatchEnded(
  fixture: Pick<Fixture, 'gameState' | 'kickoffTs' | 'status'>,
  opts?: { finalised?: boolean; statusId?: number | null },
  nowMs = Date.now(),
): boolean {
  if (opts?.finalised) return true;
  const sid = opts?.statusId;
  if (sid != null && FINISHED_GAME_STATES.has(sid)) return true;
  return fixtureBucket(fixture, nowMs) === 'finished';
}

/**
 * Apply TxLINE score lifecycle onto fixtures so board/list match Match Centre.
 * Patches gameState/status when the score feed reports finalised / in-play.
 */
export function applyScoreLifecycle(
  fixture: Fixture,
  opts: { finalised?: boolean; statusId?: number | null },
): Fixture {
  if (opts.finalised || (opts.statusId != null && FINISHED_GAME_STATES.has(opts.statusId))) {
    return {
      ...fixture,
      gameState: opts.statusId != null && FINISHED_GAME_STATES.has(opts.statusId)
        ? opts.statusId
        : 100,
      status: 'finished',
    };
  }
  if (opts.statusId != null && opts.statusId >= 2) {
    return {
      ...fixture,
      gameState: opts.statusId,
      status: 'live',
    };
  }
  return fixture;
}

/**
 * Match is finished (score is reliable) but pledge settlement may still be
 * catching up — show "Results pending" for pledges, not wrong FT messaging.
 */
export function isPledgeResultsPending(
  fixture: Pick<Fixture, 'gameState' | 'kickoffTs' | 'status'>,
  opts?: { finalised?: boolean; statusId?: number | null },
  nowMs = Date.now(),
): boolean {
  if (!isMatchEnded(fixture, opts, nowMs)) return false;
  const kickoff = Number(fixture.kickoffTs);
  if (!Number.isFinite(kickoff) || kickoff <= 0) return false;
  const estFt = kickoff + EST_FULL_TIME_MS;
  // Pending from a few minutes before estimated FT through the settlement window.
  return nowMs >= estFt - 10 * 60 * 1000 && nowMs <= estFt + PLEDGE_RESULTS_PENDING_MS;
}

export function filterFixturesByBucket(
  fixtures: Fixture[],
  bucket: FixtureBucket,
  nowMs = Date.now(),
): Fixture[] {
  return fixtures
    .filter((f) => fixtureBucket(f, nowMs) === bucket)
    .sort((a, b) => {
      if (bucket === 'finished') return b.kickoffTs - a.kickoffTs;
      return a.kickoffTs - b.kickoffTs;
    });
}

/** Which time tab contains this fixture (for auto-switching filters). */
export function bucketForFixture(fixture: Fixture, nowMs = Date.now()): FixtureBucket {
  return fixtureBucket(fixture, nowMs);
}

/** Pledges are World Cup only — never friendlies / other leagues. */
export function isWorldCupFixture(fixture: Pick<Fixture, 'fixtureId' | 'competition' | 'competitionKind'>): boolean {
  if (fixture.competitionKind === 'world_cup') return true;
  if (fixture.competitionKind === 'other') return false;
  return enrichFixtureMeta({
    fixtureId: fixture.fixtureId,
    competition: fixture.competition,
    homeTeam: '',
    awayTeam: '',
    kickoffTs: 0,
  }).kind === 'world_cup';
}

/** Knockout only — group stage is hidden (too many matches / teams). */
export function isKnockoutWorldCupFixture(
  fixture: Pick<Fixture, 'fixtureId' | 'competition' | 'competitionKind' | 'stage'>,
): boolean {
  if (!isWorldCupFixture(fixture)) return false;
  const stage = fixture.stage ?? stageForFixtureId(fixture.fixtureId);
  return isKnockoutStage(stage);
}

/**
 * Matches fans may pledge on: knockout WC + live or upcoming (not finished).
 */
export function isPledgeableFixture(fixture: Fixture, nowMs = Date.now()): boolean {
  if (!isKnockoutWorldCupFixture(fixture)) return false;
  const bucket = fixtureBucket(fixture, nowMs);
  return bucket === 'upcoming' || bucket === 'live';
}

/**
 * New commitment create — knockout WC while match is upcoming or live
 * (mirrors on-chain MATCH_WINDOW after kickoff).
 */
export function canCreatePledge(fixture: Fixture, nowMs = Date.now()): boolean {
  return isPledgeableFixture(fixture, nowMs);
}

/** Curated WC list for browse / filters — knockout rounds only. */
export function worldCupFixtures(fixtures: Fixture[]): Fixture[] {
  return fixtures.filter(isKnockoutWorldCupFixture);
}
