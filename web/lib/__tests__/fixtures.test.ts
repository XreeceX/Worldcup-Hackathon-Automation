import { describe, expect, it } from 'vitest';
import {
  EST_FULL_TIME_MS,
  MATCH_WINDOW_MS,
  fixtureBucket,
  mergeFixturesMonotonic,
} from '../fixtures';
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
