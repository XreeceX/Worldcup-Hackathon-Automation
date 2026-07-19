'use client';

import { CountryFlag } from '@/components/CountryFlag';
import { shortPlayerName } from '@/lib/matchData';
import type { LineupBand, LineupPlayer, TeamLineup } from '@/lib/types';

function PlayerChip({
  player,
  side,
}: {
  player: LineupPlayer;
  side: 'home' | 'away';
}) {
  const shirt = player.shirt ?? '—';
  const homeKit =
    'border-white bg-white text-ink shadow-[0_2px_8px_rgba(0,0,0,0.35)]';
  const awayKit =
    'border-amber-200/90 bg-ink text-white shadow-[0_2px_8px_rgba(0,0,0,0.45)]';

  return (
    <div className="relative flex w-[4.25rem] flex-col items-center text-center sm:w-[5rem]">
      {player.subbedOff && (
        <span
          className="absolute -right-0.5 -top-0.5 z-10 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-rose-600 text-[8px] font-black text-white shadow"
          title="Substituted off"
        >
          ↓
        </span>
      )}
      {player.subbedOn && !player.starter && (
        <span
          className="absolute -right-0.5 -top-0.5 z-10 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-pitch-500 text-[8px] font-black text-ink shadow"
          title="Substituted on"
        >
          ↑
        </span>
      )}
      <div
        className={`relative flex h-9 w-9 items-center justify-center rounded-full border-2 font-mono text-xs font-black sm:h-10 sm:w-10 sm:text-sm ${
          side === 'home' ? homeKit : awayKit
        }`}
      >
        {shirt}
        {(player.goals > 0 || player.yellowCards > 0 || player.redCards > 0) && (
          <span className="absolute -bottom-1 left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-full bg-ink/95 px-1 py-px text-[7px] font-bold text-white">
            {player.goals > 0 && <span>⚽{player.goals > 1 ? `×${player.goals}` : ''}</span>}
            {player.yellowCards > 0 && <span className="text-amber-300">■</span>}
            {player.redCards > 0 && <span className="text-rose-400">■</span>}
          </span>
        )}
      </div>
      <p className="mt-1.5 max-w-full truncate text-[9px] font-bold leading-tight text-white drop-shadow sm:text-[10px]">
        <span className="text-white/75">{shirt} </span>
        {shortPlayerName(player.name)}
      </p>
    </div>
  );
}

function BandRow({
  players,
  side,
}: {
  players: LineupPlayer[];
  side: 'home' | 'away';
}) {
  if (!players.length) return null;
  return (
    <div className="flex w-full items-center justify-center gap-2 sm:gap-3">
      {players.map((p) => (
        <PlayerChip key={p.playerId} player={p} side={side} />
      ))}
    </div>
  );
}

function HalfPitch({
  lineup,
  teamName,
  side,
  flip,
}: {
  lineup: TeamLineup;
  teamName: string;
  side: 'home' | 'away';
  /** Away side: reverse band order so attack faces midfield. */
  flip?: boolean;
}) {
  const bands: LineupBand[] = flip
    ? ['fwd', 'mid', 'def', 'gk']
    : ['gk', 'def', 'mid', 'fwd'];

  return (
    <div
      className={`flex h-full min-h-0 flex-col ${
        side === 'home' ? 'bg-emerald-950/25' : 'bg-teal-950/30'
      }`}
    >
      <div
        className={`flex shrink-0 items-center gap-2 px-3 py-2.5 ${
          flip ? 'order-last flex-row-reverse' : ''
        }`}
      >
        <CountryFlag team={teamName} size={22} />
        <span className="truncate text-sm font-bold text-white">{teamName}</span>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black ${
            side === 'home'
              ? 'bg-white text-ink'
              : 'bg-amber-200 text-ink'
          } ${flip ? 'mr-auto' : 'ml-auto'}`}
        >
          {lineup.formation}
        </span>
      </div>
      <div
        className={`grid min-h-0 flex-1 grid-rows-4 gap-1 px-2 sm:gap-2 sm:px-3 ${
          flip ? 'pb-2 pt-1' : 'pb-1 pt-2'
        }`}
      >
        {bands.map((band) => (
          <div key={band} className="flex min-h-0 items-center justify-center py-0.5">
            <BandRow
              players={lineup.starters.filter((p) => p.band === band)}
              side={side}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function LineupPitch({
  homeTeam,
  awayTeam,
  home,
  away,
}: {
  homeTeam: string;
  awayTeam: string;
  home: TeamLineup | null;
  away: TeamLineup | null;
}) {
  if (!home && !away) {
    return (
      <p className="py-8 text-center text-sm text-muted">
        Lineups will appear here when the feed publishes them.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div
        className="relative overflow-hidden rounded-xl border border-pitch-600/40 shadow-inner"
        style={{
          background:
            'linear-gradient(180deg, #1a6b3a 0%, #15803d 35%, #166534 65%, #14532d 100%)',
        }}
      >
        {/* Pitch markings (vertical pitch: goals top/bottom) */}
        <div className="pointer-events-none absolute inset-0 opacity-25">
          <div className="absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white sm:h-28 sm:w-28" />
          <div className="absolute inset-x-10 top-0 h-12 border-x border-b border-white sm:inset-x-20 sm:h-16" />
          <div className="absolute inset-x-10 bottom-0 h-12 border-x border-t border-white sm:inset-x-20 sm:h-16" />
        </div>

        <div className="relative grid min-h-[40rem] grid-rows-[1fr_auto_1fr] sm:min-h-[48rem]">
          <div className="min-h-0 overflow-hidden">
            {home ? (
              <HalfPitch
                lineup={home}
                teamName={home.teamName || homeTeam}
                side="home"
              />
            ) : (
              <p className="flex h-full items-center justify-center text-xs text-white/60">
                Waiting for {homeTeam} lineup…
              </p>
            )}
          </div>

          {/* Midfield buffer — keeps the two XIs visually separate */}
          <div className="relative z-10 flex items-center justify-center gap-3 py-3">
            <div className="h-px flex-1 bg-white/40" />
            <span className="rounded-full border border-white/30 bg-ink/50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white/90 backdrop-blur-sm">
              Halfway
            </span>
            <div className="h-px flex-1 bg-white/40" />
          </div>

          <div className="min-h-0 overflow-hidden">
            {away ? (
              <HalfPitch
                lineup={away}
                teamName={away.teamName || awayTeam}
                side="away"
                flip
              />
            ) : (
              <p className="flex h-full items-center justify-center text-xs text-white/60">
                Waiting for {awayTeam} lineup…
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Bench */}
      {([
        [homeTeam, home, 'home'] as const,
        [awayTeam, away, 'away'] as const,
      ]).map(([name, lineup, side]) =>
        lineup && lineup.bench.length ? (
          <div key={name}>
            <p className="mb-1.5 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted">
              <CountryFlag team={name} size={16} /> {name} bench
            </p>
            <div className="flex flex-wrap gap-1.5">
              {lineup.bench.map((p) => (
                <span
                  key={p.playerId}
                  className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold ${
                    side === 'home'
                      ? 'border-edge bg-raised/50'
                      : 'border-amber-500/25 bg-amber-500/5'
                  }`}
                >
                  <span className="font-mono text-muted">{p.shirt ?? '—'}</span>
                  {shortPlayerName(p.name)}
                  {p.subbedOn ? (
                    <span className="text-pitch-400" title="Came on">
                      ↑
                    </span>
                  ) : null}
                </span>
              ))}
            </div>
          </div>
        ) : null,
      )}
    </div>
  );
}
