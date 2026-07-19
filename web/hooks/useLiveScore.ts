'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchScoreFeed, liveScoresUrl } from '@/lib/api';
import {
  EMPTY_SCORE,
  buildMatchFromRecords,
  enrichLineupsWithMatchData,
  parseScoreRecord,
  sanitizeTimelineEvents,
} from '@/lib/matchData';
import type { LiveScoreState, MatchEvent } from '@/lib/types';
import { useEventSource } from './useEventSource';

function scoreProgress(s: LiveScoreState): number {
  return (s.homeGoals ?? 0) + (s.awayGoals ?? 0) + (s.finalised ? 1000 : 0);
}

/** Prefer newer / more complete score; never regress finalised or goal totals. */
function mergeScoreMonotonic(
  prev: LiveScoreState,
  next: LiveScoreState,
): LiveScoreState {
  if (prev.finalised && !next.finalised) return prev;
  if (next.finalised && !prev.finalised) return next;
  if (scoreProgress(next) < scoreProgress(prev)) {
    return {
      ...next,
      homeGoals: Math.max(prev.homeGoals ?? 0, next.homeGoals ?? 0),
      awayGoals: Math.max(prev.awayGoals ?? 0, next.awayGoals ?? 0),
      finalised: prev.finalised || next.finalised,
      statusId: next.statusId ?? prev.statusId,
      minute: next.minute ?? prev.minute,
      lineups: {
        home: next.lineups.home ?? prev.lineups.home,
        away: next.lineups.away ?? prev.lineups.away,
      },
      playerDirectory: { ...prev.playerDirectory, ...next.playerDirectory },
    };
  }
  return {
    ...next,
    finalised: prev.finalised || next.finalised,
    homeGoals: Math.max(prev.homeGoals ?? 0, next.homeGoals ?? 0),
    awayGoals: Math.max(prev.awayGoals ?? 0, next.awayGoals ?? 0),
  };
}

/** Live score + full match feed for one fixture via keeper + SSE. */
export function useLiveScore(fixtureId: number | null) {
  const [score, setScore] = useState<LiveScoreState>(EMPTY_SCORE);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [hasData, setHasData] = useState(false);
  const fetchGen = useRef(0);

  useEffect(() => {
    if (fixtureId == null) {
      setScore(EMPTY_SCORE);
      setEvents([]);
      setHasData(false);
      return;
    }
    const gen = ++fetchGen.current;
    let cancelled = false;
    fetchScoreFeed(fixtureId)
      .then((rows) => {
        if (cancelled || gen !== fetchGen.current || !rows.length) return;
        const built = buildMatchFromRecords(rows);
        if (!built.hasData) return;
        setScore((prev) => mergeScoreMonotonic(prev, built.score));
        setEvents((prev) => {
          if (prev.length && built.events.length < prev.length) return prev;
          return built.events.length ? built.events : prev;
        });
        setHasData(true);
      })
      .catch(() => {
        /* feed optional — SSE may still fill in */
      });
    return () => {
      cancelled = true;
    };
  }, [fixtureId]);

  const onMessage = useCallback((data: unknown) => {
    if (!data || typeof data !== 'object') return;
    const d = data as Record<string, unknown>;
    setHasData(true);
    setScore((prev) => {
      const { score: next, events: additions } = parseScoreRecord(d, prev);
      const merged = mergeScoreMonotonic(prev, next);
      if (additions.length) {
        setEvents((cur) => {
          const seen = new Set(cur.map((e) => e.id));
          const mergedEv = [...cur];
          for (const ev of additions) {
            if (seen.has(ev.id)) continue;
            mergedEv.push(ev);
          }
          const cleaned = sanitizeTimelineEvents(mergedEv, merged);
          // Keep pitch badges in sync with the live timeline.
          setScore((s) => ({
            ...s,
            lineups: enrichLineupsWithMatchData(s.lineups, cleaned, s.players),
          }));
          return cleaned;
        });
      }
      return merged;
    });
  }, []);

  const state = useEventSource(fixtureId != null ? liveScoresUrl(fixtureId) : null, onMessage);
  return { score, events, state, hasData };
}
