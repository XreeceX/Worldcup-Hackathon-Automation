'use client';

import { CountryFlag } from '@/components/CountryFlag';
import { CardGlyph, EventGlyph } from '@/components/EventGlyph';
import type { MatchEvent } from '@/lib/types';

function teamLabel(
  team: 'home' | 'away' | null,
  home: string,
  away: string,
  text: string,
): string {
  return text
    .replace(/— home/gi, `— ${home}`)
    .replace(/— away/gi, `— ${away}`)
    .replace(/\bhome\b/gi, home)
    .replace(/\baway\b/gi, away);
}

function positionHint(detail: string | null): string | null {
  if (!detail) return null;
  // Keep secondary detail that isn't the player name alone
  return detail;
}

/** Side that gains a goal on the scoreboard (own goals credit the opponent). */
function scoringSide(ev: MatchEvent): 'home' | 'away' | null {
  if (!ev.team) return null;
  if (ev.action === 'own_goal' || /own\s*goal/i.test(ev.label)) {
    return ev.team === 'home' ? 'away' : 'home';
  }
  return ev.team;
}

/**
 * Score immediately after each goal event (chronological).
 * Keyed by event id for timeline cards.
 */
export function runningScoresByGoalId(
  events: MatchEvent[],
): Map<string, { home: number; away: number }> {
  const map = new Map<string, { home: number; away: number }>();
  let home = 0;
  let away = 0;
  const chronological = [...events]
    .filter((e) => e.kind === 'goal')
    .sort((a, b) => {
      const sa = a.clockSeconds ?? a.seq ?? 0;
      const sb = b.clockSeconds ?? b.seq ?? 0;
      if (sa !== sb) return sa - sb;
      if (a.ts !== b.ts) return a.ts - b.ts;
      return a.seq - b.seq;
    });

  for (const ev of chronological) {
    const side = scoringSide(ev);
    if (side === 'home') home += 1;
    else if (side === 'away') away += 1;
    map.set(ev.id, { home, away });
  }
  return map;
}

/** Rich GOAL card (broadcast style). */
function GoalCard({
  ev,
  homeTeam,
  awayTeam,
  homeGoals,
  awayGoals,
}: {
  ev: MatchEvent;
  homeTeam: string;
  awayTeam: string;
  homeGoals: number;
  awayGoals: number;
}) {
  const playerTeam =
    ev.team === 'home' ? homeTeam : ev.team === 'away' ? awayTeam : null;
  const credited = scoringSide(ev);
  const creditedTeam =
    credited === 'home' ? homeTeam : credited === 'away' ? awayTeam : null;
  const isPenalty = /penalt/i.test(`${ev.action ?? ''} ${ev.detail ?? ''} ${ev.label}`);
  const isOwnGoal = ev.action === 'own_goal' || /own\s*goal/i.test(ev.label);
  const scorer = ev.playerName ?? (isOwnGoal ? 'Own goal' : 'Goal');
  const kindLabel = isOwnGoal
    ? 'Own goal'
    : isPenalty
      ? 'Penalty'
      : teamLabel(ev.team, homeTeam, awayTeam, ev.label);

  return (
    <li className="shrink-0 overflow-hidden rounded-xl border border-rose-500/35 bg-raised/70">
      <div className="flex items-stretch">
        <div className="flex w-14 shrink-0 flex-col items-center justify-center bg-rose-600 px-1 py-3 text-center">
          <span className="text-base" aria-hidden>
            ⚽
          </span>
          <span className="mt-1 font-mono text-[11px] font-black text-white">
            {ev.minute ?? '—'}
          </span>
        </div>
        <div className="min-w-0 flex-1 px-3 py-2.5">
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate text-base font-bold text-ink">{scorer}</p>
            <p className="shrink-0 font-mono text-sm font-black tabular-nums text-ink">
              <span className={creditedTeam === homeTeam ? 'text-rose-300' : 'text-muted'}>
                {homeGoals}
              </span>
              <span className="text-muted">–</span>
              <span className={creditedTeam === awayTeam ? 'text-rose-300' : 'text-muted'}>
                {awayGoals}
              </span>
            </p>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
            {playerTeam && (
              <span className="inline-flex items-center gap-1 font-semibold text-ink/80">
                <CountryFlag team={playerTeam} size={14} />
                {playerTeam}
              </span>
            )}
            <span className="font-semibold text-pitch-400">{kindLabel}</span>
          </div>
          {ev.detail && ev.detail !== scorer && (
            <p className="mt-1 text-[11px] leading-snug text-muted">{ev.detail}</p>
          )}
        </div>
      </div>
    </li>
  );
}

/** Rich SUBSTITUTION card. */
function SubCard({
  ev,
  homeTeam,
  awayTeam,
}: {
  ev: MatchEvent;
  homeTeam: string;
  awayTeam: string;
}) {
  const teamName = ev.team === 'home' ? homeTeam : ev.team === 'away' ? awayTeam : null;
  const playerIn = ev.playerName;
  const playerOut = ev.relatedPlayerName;

  return (
    <li className="shrink-0 overflow-hidden rounded-xl border border-edge bg-raised/60">
      <div className="flex items-center justify-between gap-2 border-b border-edge px-3 py-2">
        <span className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-ink">
          <span className="inline-flex flex-col leading-none">
            <span className="text-pitch-400">↑</span>
            <span className="text-rose-400">↓</span>
          </span>
          Substitution
        </span>
        <span className="font-mono text-xs font-bold text-muted">{ev.minute ?? '—'}</span>
      </div>
      <div className="grid grid-cols-2 gap-3 px-3 py-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-pitch-400">
            <span aria-hidden>↑</span> In
          </p>
          <p className="mt-1 truncate text-sm font-bold">{playerIn ?? '—'}</p>
          {teamName && (
            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted">
              <CountryFlag team={teamName} size={14} />
              {teamName}
            </p>
          )}
        </div>
        <div className="min-w-0 border-l border-edge/80 pl-3">
          <p className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-rose-400">
            <span aria-hidden>↓</span> Out
          </p>
          <p className="mt-1 truncate text-sm font-bold">{playerOut ?? '—'}</p>
          {teamName && (
            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted">
              <CountryFlag team={teamName} size={14} />
              {teamName}
            </p>
          )}
        </div>
      </div>
    </li>
  );
}

/** Hydration break — duration uses the same "+N min" style as stoppage. */
function HydrationCard({ ev }: { ev: MatchEvent }) {
  const durationMatch = ev.detail?.match(/\+(\d+)\s*min/);
  const durationMin = durationMatch ? Number(durationMatch[1]) : 3;
  const half =
    /1st half/i.test(ev.detail ?? '')
      ? '1st half'
      : /2nd half/i.test(ev.detail ?? '')
        ? '2nd half'
        : null;

  return (
    <li className="shrink-0 overflow-hidden rounded-xl border border-sky-500/30 bg-raised/60">
      <div className="flex items-center justify-between gap-2 border-b border-edge px-3 py-2">
        <span className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-ink">
          <span aria-hidden>💧</span>
          Hydration break
        </span>
        <span className="font-mono text-xs font-bold text-muted">{ev.minute ?? '—'}</span>
      </div>
      <div className="px-3 py-3">
        <p className="text-sm font-bold text-sky-300">+{durationMin} min</p>
        <p className="mt-0.5 text-xs text-muted">
          {[half, 'FIFA drinks break', 'added to stoppage'].filter(Boolean).join(' · ')}
        </p>
      </div>
    </li>
  );
}

/** Compact default event row. */
function DefaultEventRow({
  ev,
  homeTeam,
  awayTeam,
}: {
  ev: MatchEvent;
  homeTeam: string;
  awayTeam: string;
}) {
  const lines = (() => {
    if (ev.playerName && ev.detail && ev.detail !== ev.playerName) {
      return [ev.playerName, ev.detail];
    }
    if (ev.playerName) return [ev.playerName];
    if (!ev.detail) return [];
    if (ev.kind === 'sub' && ev.detail.includes(' · ')) {
      return ev.detail.split(' · ').map((s) => s.trim()).filter(Boolean);
    }
    return [ev.detail];
  })();

  return (
    <li className="flex shrink-0 items-start gap-2.5 rounded-xl border border-edge bg-raised/40 px-3 py-2.5 text-sm">
      <span className="w-12 shrink-0 pt-0.5 font-mono text-xs font-bold text-muted">
        {ev.minute ?? '—'}
      </span>
      <span className="mt-0.5 flex w-5 shrink-0 justify-center">
        {ev.kind === 'card' && /red/i.test(`${ev.action ?? ''} ${ev.label}`) ? (
          <CardGlyph color="red" />
        ) : ev.kind === 'card' ? (
          <CardGlyph color="yellow" />
        ) : (
          <EventGlyph kind={ev.kind} action={ev.action} />
        )}
      </span>
      {ev.team ? (
        <CountryFlag team={ev.team === 'home' ? homeTeam : awayTeam} size={20} />
      ) : (
        <span className="w-5" />
      )}
      <span className="min-w-0 flex-1">
        <span className="font-semibold">
          {teamLabel(ev.team, homeTeam, awayTeam, ev.label)}
        </span>
        {lines.map((line) => (
          <span key={line} className="mt-0.5 block text-xs text-muted">
            {positionHint(line)}
          </span>
        ))}
      </span>
    </li>
  );
}

/** Compact taker row: time + flag + player (corners, free kicks, pens). */
function TakerRow({
  ev,
  homeTeam,
  awayTeam,
  fallbackLabel,
}: {
  ev: MatchEvent;
  homeTeam: string;
  awayTeam: string;
  fallbackLabel: string;
}) {
  const teamName = ev.team === 'home' ? homeTeam : ev.team === 'away' ? awayTeam : null;
  const taker =
    ev.playerName ??
    (ev.detail?.replace(/^Taken by\s+/i, '').split(' · ')[0]?.trim() || null);
  const showName = taker && !/^player #\d+$/i.test(taker) ? taker : null;

  return (
    <li className="flex shrink-0 items-center gap-2.5 rounded-xl border border-edge bg-raised/40 px-3 py-2.5 text-sm">
      <span className="w-12 shrink-0 font-mono text-xs font-bold text-muted">
        {ev.minute ?? '—'}
      </span>
      {teamName ? (
        <CountryFlag team={teamName} size={20} />
      ) : (
        <span className="w-5" />
      )}
      <span className="min-w-0 flex-1 truncate font-semibold">
        {showName ?? (teamName ? `${fallbackLabel} · ${teamName}` : fallbackLabel)}
      </span>
    </li>
  );
}

export function MatchEventCard({
  ev,
  homeTeam,
  awayTeam,
  homeGoals,
  awayGoals,
}: {
  ev: MatchEvent;
  homeTeam: string;
  awayTeam: string;
  /** Score immediately after this event (for goals). */
  homeGoals: number;
  awayGoals: number;
}) {
  // Player-stat backfills often lack a clock — keep them compact.
  if (ev.kind === 'goal' && ev.minute) {
    return (
      <GoalCard
        ev={ev}
        homeTeam={homeTeam}
        awayTeam={awayTeam}
        homeGoals={homeGoals}
        awayGoals={awayGoals}
      />
    );
  }
  if (ev.kind === 'sub' && (ev.playerName || ev.relatedPlayerName)) {
    return <SubCard ev={ev} homeTeam={homeTeam} awayTeam={awayTeam} />;
  }
  if (ev.kind === 'hydration') {
    return <HydrationCard ev={ev} />;
  }
  if (ev.kind === 'corner') {
    return (
      <TakerRow
        ev={ev}
        homeTeam={homeTeam}
        awayTeam={awayTeam}
        fallbackLabel="Corner"
      />
    );
  }
  if (ev.kind === 'freekick') {
    return (
      <TakerRow
        ev={ev}
        homeTeam={homeTeam}
        awayTeam={awayTeam}
        fallbackLabel="Free kick"
      />
    );
  }
  if (
    ev.action === 'penalty' ||
    /penalt/i.test(ev.label) ||
    (/shootout/i.test(ev.label) && ev.kind === 'info')
  ) {
    return (
      <TakerRow
        ev={ev}
        homeTeam={homeTeam}
        awayTeam={awayTeam}
        fallbackLabel={ev.label.replace(/\s*—\s*(home|away)/i, '').trim() || 'Penalty'}
      />
    );
  }
  return <DefaultEventRow ev={ev} homeTeam={homeTeam} awayTeam={awayTeam} />;
}
