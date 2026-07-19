import { describe, expect, it } from 'vitest';
import {
  EST_FULL_TIME_MS,
  MATCH_WINDOW_MS,
  fixtureBucket,
  mergeFixturesMonotonic,
} from '../fixtures';
import {
  EMPTY_SCORE,
  formatFifaMinute,
  parseScoreRecord,
  scoreIndicatesFinished,
} from '../matchData';
import type { Fixture } from '../types';

function fx(
  partial: Partial<Fixture> & Pick<Fixture, 'fixtureId' | 'kickoffTs' | 'gameState'>,
): Fixture {
  return {
    homeTeam: 'A',
    awayTeam: 'B',
    competition: 'World Cup',
    status: 'upcoming',
    ...partial,
  };
}

describe('fixtureBucket', () => {
  const now = Date.parse('2026-07-01T12:00:00Z');

  it('marks future kickoffs upcoming', () => {
    expect(
      fixtureBucket(fx({ fixtureId: 1, kickoffTs: now + 3_600_000, gameState: 0 }), now),
    ).toBe('upcoming');
  });

  it('keeps in-play game states live inside the match window', () => {
    expect(
      fixtureBucket(fx({ fixtureId: 1, kickoffTs: now - 60_000, gameState: 4 }), now),
    ).toBe('live');
  });

  it('forces finished when past match window even if game_state stuck in-play', () => {
    expect(
      fixtureBucket(
        fx({ fixtureId: 1, kickoffTs: now - MATCH_WINDOW_MS - 1, gameState: 4 }),
        now,
      ),
    ).toBe('finished');
  });

  it('soft-finishes NS after estimated full time', () => {
    expect(
      fixtureBucket(
        fx({ fixtureId: 1, kickoffTs: now - EST_FULL_TIME_MS - 1, gameState: 0 }),
        now,
      ),
    ).toBe('finished');
  });

  it('respects explicit finished status', () => {
    expect(
      fixtureBucket(
        fx({
          fixtureId: 1,
          kickoffTs: now - 60_000,
          gameState: 4,
          status: 'finished',
        }),
        now,
      ),
    ).toBe('finished');
  });
});

describe('mergeFixturesMonotonic', () => {
  const now = Date.parse('2026-07-01T12:00:00Z');

  it('never regresses finished back to live', () => {
    const prev = [
      fx({
        fixtureId: 1,
        kickoffTs: now - 60_000,
        gameState: 100,
        status: 'finished',
      }),
    ];
    const next = [
      fx({
        fixtureId: 1,
        kickoffTs: now - 60_000,
        gameState: 4,
        status: 'live',
      }),
    ];
    const merged = mergeFixturesMonotonic(prev, next, now);
    expect(merged[0].status).toBe('finished');
    expect(merged[0].gameState).toBe(100);
  });
});

describe('scoreIndicatesFinished / FT clock', () => {
  it('treats statusId 5 (Ended) as finished', () => {
    expect(
      scoreIndicatesFinished({
        ...EMPTY_SCORE,
        statusId: 5,
        period: '5',
      }),
    ).toBe(true);
  });

  it('does not keep a live minute after statusId 5', () => {
    expect(formatFifaMinute(46 * 60, 5)).toBeNull();
    const { score } = parseScoreRecord(
      {
        statusId: 5,
        period: 5,
        Clock: { Seconds: 46 * 60 },
        Score: { Current: { Home: 1, Away: 2 } },
      },
      { ...EMPTY_SCORE, homeGoals: 1, awayGoals: 2, minute: "46'" },
    );
    expect(score.finalised).toBe(true);
    expect(score.minute).toBeNull();
  });

  it('marks game_finalised as finished without requiring status 100', () => {
    const { score } = parseScoreRecord(
      { action: 'game_finalised', statusId: 5 },
      EMPTY_SCORE,
    );
    expect(score.finalised).toBe(true);
    expect(score.minute).toBeNull();
  });
});
