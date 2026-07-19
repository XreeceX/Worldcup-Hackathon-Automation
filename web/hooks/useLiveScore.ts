'use client';

import { useCallback, useEffect, useState } from 'react';
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

/** Live score + full match feed for one fixture via keeper + SSE. */
export function useLiveScore(fixtureId: number | null) {
  const [score, setScore] = useState<LiveScoreState>(EMPTY_SCORE);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [hasData, setHasData] = useState(false);

  useEffect(() => {
    if (fixtureId == null) {
      setScore(EMPTY_SCORE);
      setEvents([]);
      setHasData(false);
      return;
    }
    let cancelled = false;
    fetchScoreFeed(fixtureId)
      .then((rows) => {
        if (cancelled || !rows.length) return;
        const built = buildMatchFromRecords(rows);
        if (!built.hasData) return;
        setScore(built.score);
        setEvents(built.events);
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
      if (additions.length) {
        setEvents((cur) => {
          const seen = new Set(cur.map((e) => e.id));
          const merged = [...cur];
          for (const ev of additions) {
            if (seen.has(ev.id)) continue;
            merged.push(ev);
          }
          const cleaned = sanitizeTimelineEvents(merged, next);
          // Keep pitch badges in sync with the live timeline.
          setScore((s) => ({
            ...s,
            lineups: enrichLineupsWithMatchData(s.lineups, cleaned, s.players),
          }));
          return cleaned;
        });
      }
      return next;
    });
  }, []);

  const state = useEventSource(fixtureId != null ? liveScoresUrl(fixtureId) : null, onMessage);
  return { score, events, state, hasData };
}
