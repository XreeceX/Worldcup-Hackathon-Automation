'use client';

import { useCallback, useRef, useState } from 'react';
import { liveScoresUrl } from '@/lib/api';
import type { LiveScoreState, MatchEvent } from '@/lib/types';
import { useEventSource } from './useEventSource';

const INITIAL: LiveScoreState = {
  homeGoals: 0,
  awayGoals: 0,
  minute: null,
  period: null,
  finalised: false,
};

function num(v: unknown): number | null {
  const n = typeof v === 'string' ? Number(v) : (v as number);
  return Number.isFinite(n) ? n : null;
}

/**
 * Extract home/away goals from a TxLINE score record, tolerating the shapes
 * the keeper proxy may forward: `stats` keyed by stat key (1 = P1 goals,
 * 2 = P2 goals), flat `p1Score`/`p2Score`, or `homeGoals`/`awayGoals`.
 */
function extractGoals(d: Record<string, unknown>): { home: number | null; away: number | null } {
  const stats = d.stats ?? d.Stats;
  if (stats && typeof stats === 'object' && !Array.isArray(stats)) {
    const s = stats as Record<string, unknown>;
    return { home: num(s['1']), away: num(s['2']) };
  }
  if (Array.isArray(stats)) {
    let home: number | null = null;
    let away: number | null = null;
    for (const entry of stats as Record<string, unknown>[]) {
      const key = num(entry.key ?? entry.statKey);
      const value = num(entry.value ?? entry.statValue);
      if (key === 1) home = value;
      if (key === 2) away = value;
    }
    return { home, away };
  }
  return {
    home: num(d.p1Score ?? d.P1Score ?? d.homeGoals ?? d.homeScore),
    away: num(d.p2Score ?? d.P2Score ?? d.awayGoals ?? d.awayScore),
  };
}

/** Live score stream for one fixture via the keeper score proxy (§6.5). */
export function useLiveScore(fixtureId: number | null) {
  const [score, setScore] = useState<LiveScoreState>(INITIAL);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const prevRef = useRef<{ home: number; away: number }>({ home: 0, away: 0 });
  const [hasData, setHasData] = useState(false);

  const onMessage = useCallback((data: unknown) => {
    if (!data || typeof data !== 'object') return;
    const d = data as Record<string, unknown>;
    const action = typeof d.action === 'string' ? d.action : null;
    const { home, away } = extractGoals(d);
    const minuteRaw = d.gameTime ?? d.minute ?? d.matchTime ?? d.time;
    const minute =
      minuteRaw != null && (typeof minuteRaw === 'string' || typeof minuteRaw === 'number')
        ? String(minuteRaw)
        : null;
    const period = typeof d.period === 'string' || typeof d.period === 'number' ? String(d.period) : null;
    const finalised = action === 'game_finalised' && num(d.statusId) === 100;

    setHasData(true);
    setScore((prev) => ({
      homeGoals: home ?? prev.homeGoals,
      awayGoals: away ?? prev.awayGoals,
      minute: minute ?? prev.minute,
      period: period ?? prev.period,
      finalised: prev.finalised || finalised,
    }));

    // Event log: goals derived from score deltas; cards/other from `action`.
    const prev = prevRef.current;
    const now = Date.now();
    const additions: MatchEvent[] = [];
    if (home != null && home > prev.home) {
      additions.push({ id: `g-h-${home}-${now}`, kind: 'goal', team: 'home', label: `Goal — home team (${home}–${away ?? prev.away})`, minute, ts: now });
    }
    if (away != null && away > prev.away) {
      additions.push({ id: `g-a-${away}-${now}`, kind: 'goal', team: 'away', label: `Goal — away team (${home ?? prev.home}–${away})`, minute, ts: now });
    }
    if (action && /card/i.test(action)) {
      additions.push({ id: `c-${now}`, kind: 'card', team: null, label: action.replace(/_/g, ' '), minute, ts: now });
    }
    if (finalised) {
      additions.push({ id: `ft-${now}`, kind: 'info', team: null, label: 'Full time — match finalised', minute, ts: now });
    }
    prevRef.current = { home: home ?? prev.home, away: away ?? prev.away };
    if (additions.length) setEvents((cur) => [...additions, ...cur].slice(0, 30));
  }, []);

  const state = useEventSource(fixtureId != null ? liveScoresUrl(fixtureId) : null, onMessage);
  return { score, events, state, hasData };
}
