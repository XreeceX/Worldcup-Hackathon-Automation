'use client';

import { CountryFlag } from '@/components/CountryFlag';
import { CardGlyph } from '@/components/EventGlyph';
import type { MatchStats } from '@/lib/types';

type Row = {
  key: string;
  label: string;
  home: number;
  away: number;
  lowerWins?: boolean;
  icon?: 'yellow' | 'red';
};

function leadClass(homeLead: boolean, awayLead: boolean, side: 'home' | 'away') {
  if (side === 'home' && homeLead) return 'bg-sky-500 text-ink shadow-md shadow-sky-900/40';
  if (side === 'away' && awayLead) return 'bg-rose-500 text-white shadow-md shadow-rose-900/40';
  return 'text-ink/90';
}

function StatCompareRow({ row }: { row: Row }) {
  const homeLead = row.lowerWins ? row.home < row.away : row.home > row.away;
  const awayLead = row.lowerWins ? row.away < row.home : row.away > row.home;

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-3">
      <div className="flex justify-end">
        <span
          className={`inline-flex min-w-[2.5rem] items-center justify-center rounded-full px-2.5 py-1 font-mono text-base font-black tabular-nums ${leadClass(
            homeLead,
            awayLead,
            'home',
          )}`}
        >
          {row.home}
        </span>
      </div>
      <div className="flex min-w-[8rem] items-center justify-center gap-1.5 px-1">
        {row.icon === 'yellow' ? (
          <CardGlyph color="yellow" size="sm" />
        ) : row.icon === 'red' ? (
          <CardGlyph color="red" size="sm" />
        ) : null}
        <span className="text-center text-sm font-semibold text-muted">{row.label}</span>
      </div>
      <div className="flex justify-start">
        <span
          className={`inline-flex min-w-[2.5rem] items-center justify-center rounded-full px-2.5 py-1 font-mono text-base font-black tabular-nums ${leadClass(
            homeLead,
            awayLead,
            'away',
          )}`}
        >
          {row.away}
        </span>
      </div>
    </div>
  );
}

/**
 * Match totals from the official TxLINE Score / Stats map only.
 * Event-tallied counters (shots, throw-ins, etc.) are incomplete and omitted.
 */
export function TeamStatsBroadcast({
  homeTeam,
  awayTeam,
  stats,
}: {
  homeTeam: string;
  awayTeam: string;
  stats: MatchStats;
}) {
  const rows: Row[] = [
    { key: 'goals', label: 'Goals', home: stats.homeGoals, away: stats.awayGoals },
    { key: 'corners', label: 'Corners', home: stats.homeCorners, away: stats.awayCorners },
    {
      key: 'yellow',
      label: 'Yellow cards',
      home: stats.homeYellows,
      away: stats.awayYellows,
      icon: 'yellow',
      lowerWins: true,
    },
    {
      key: 'red',
      label: 'Red cards',
      home: stats.homeReds,
      away: stats.awayReds,
      icon: 'red',
      lowerWins: true,
    },
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-edge bg-surface/80">
      <div className="flex items-center justify-between gap-3 border-b border-edge px-4 py-4">
        <span className="inline-flex min-w-0 items-center gap-2 font-display text-sm font-extrabold uppercase tracking-wide">
          <CountryFlag team={homeTeam} size={28} />
          <span className="truncate">{homeTeam}</span>
        </span>
        <p className="shrink-0 text-[10px] font-black uppercase tracking-[0.2em] text-muted">
          Match totals
        </p>
        <span className="inline-flex min-w-0 items-center justify-end gap-2 font-display text-sm font-extrabold uppercase tracking-wide">
          <span className="truncate">{awayTeam}</span>
          <CountryFlag team={awayTeam} size={28} />
        </span>
      </div>

      <div className="divide-y divide-edge/70 px-4">
        {rows.map((row) => (
          <StatCompareRow key={row.key} row={row} />
        ))}
      </div>

      <p className="border-t border-edge px-4 py-3 text-center text-[11px] text-muted">
        Official Score feed · goals, corners & cards
      </p>
    </div>
  );
}
