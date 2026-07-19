'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchScoreFeed, liveScoresUrl } from '@/lib/api';
import { MATCH_WINDOW_MS } from '@/lib/fixtures';
import {
  EMPTY_SCORE,
  buildMatchFromRecords,
  enrichLineupsWithMatchData,
  parseScoreRecord,
  sanitizeTimelineEvents,
  scoreIndicatesFinished,
} from '@/lib/matchData';
import type { LiveScoreState, MatchEvent } from '@/lib/types';
import { useEventSource } from './useEventSource';

function scoreProgress(s: LiveScoreState): number {
  return (s.homeGoals ?? 0) + (s.awayGoals ?? 0) + (s.finalised ? 1000 : 0);
}

function freezeIfFinished(score: LiveScoreState): LiveScoreState {
  if (!scoreIndicatesFinished(score)) return score;
  return { ...score, finalised: true, minute: null };
}

/** Prefer newer / more complete score; never regress finalised or goal totals. */
function mergeScoreMonotonic(
  prev: LiveScoreState,
  next: LiveScoreState,
): LiveScoreState {
  if (prev.finalised && !next.finalised) {
    return freezeIfFinished({ ...prev, minute: null });
  }
  if (next.finalised && !prev.finalised) {
    return freezeIfFinished({ ...next, minute: null });
  }
  if (scoreProgress(next) < scoreProgress(prev)) {
    return freezeIfFinished({
      ...next,
      homeGoals: Math.max(prev.homeGoals ?? 0, next.homeGoals ?? 0),
      awayGoals: Math.max(prev.awayGoals ?? 0, next.awayGoals ?? 0),
      finalised: prev.finalised || next.finalised,
      statusId: next.statusId ?? prev.statusId,
      minute: prev.finalised || next.finalised ? null : (next.minute ?? prev.minute),
      lineups: {
        home: next.lineups.home ?? prev.lineups.home,
        away: next.lineups.away ?? prev.lineups.away,
      },
      playerDirectory: { ...prev.playerDirectory, ...next.playerDirectory },
    });
  }
  return freezeIfFinished({
    ...next,
    finalised: prev.finalised || next.finalised,
    homeGoals: Math.max(prev.homeGoals ?? 0, next.homeGoals ?? 0),
    awayGoals: Math.max(prev.awayGoals ?? 0, next.awayGoals ?? 0),
    minute:
      prev.finalised || next.finalised || scoreIndicatesFinished(next)
        ? null
        : next.minute,
  });
}

function forceFinishedByKickoff(
  score: LiveScoreState,
  kickoffTs: number | null | undefined,
  nowMs = Date.now(),
): LiveScoreState {
  if (kickoffTs == null || !Number.isFinite(kickoffTs) || kickoffTs <= 0) return score;
  if (nowMs - kickoffTs < MATCH_WINDOW_MS) return score;
  return { ...score, finalised: true, minute: null, statusId: score.statusId ?? 100 };
}

/** Live score + full match feed for one fixture via keeper + SSE. */
export function useLiveScore(
  fixtureId: number | null,
  kickoffTs?: number | null,
) {
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
        setScore((prev) =>
          forceFinishedByKickoff(
            mergeScoreMonotonic(prev, built.score),
            kickoffTs,
          ),
        );
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
  }, [fixtureId, kickoffTs]);

  // Time-based FT even if the feed never flips statusId.
  useEffect(() => {
    if (kickoffTs == null || !Number.isFinite(kickoffTs)) return;
    const apply = () => {
      setScore((prev) => forceFinishedByKickoff(prev, kickoffTs));
    };
    apply();
    const timer = setInterval(apply, 30_000);
    return () => clearInterval(timer);
  }, [kickoffTs]);

  const onMessage = useCallback(
    (data: unknown) => {
      if (!data || typeof data !== 'object') return;
      const d = data as Record<string, unknown>;
      setHasData(true);
      setScore((prev) => {
        const alreadyDone = scoreIndicatesFinished(prev) || prev.finalised;
        const { score: next, events: additions } = parseScoreRecord(
          d,
          alreadyDone ? { ...prev, finalised: true, minute: null } : prev,
        );
        const merged = forceFinishedByKickoff(
          mergeScoreMonotonic(prev, next),
          kickoffTs,
        );
        if (additions.length) {
          setEvents((cur) => {
            const seen = new Set(cur.map((e) => e.id));
            const mergedEv = [...cur];
            for (const ev of additions) {
              if (seen.has(ev.id)) continue;
              mergedEv.push(ev);
            }
            const cleaned = sanitizeTimelineEvents(mergedEv, merged);
            if (!merged.finalised) {
              setScore((s) => ({
                ...s,
                lineups: enrichLineupsWithMatchData(s.lineups, cleaned, s.players),
              }));
            }
            return cleaned;
          });
        }
        return merged;
      });
    },
    [kickoffTs],
  );

  const state = useEventSource(fixtureId != null ? liveScoresUrl(fixtureId) : null, onMessage);
  return { score, events, state, hasData };
}
