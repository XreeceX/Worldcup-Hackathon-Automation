'use client';

import { useMemo, useState } from 'react';
import { CountryFlag } from '@/components/CountryFlag';
import { CardGlyph } from '@/components/EventGlyph';
import { LineupPitch } from '@/components/LineupPitch';
import { MatchEventCard, runningScoresByGoalId } from '@/components/MatchEventCard';
import { TeamStatsBroadcast } from '@/components/TeamStatsBroadcast';
import {
  FIFA_HYDRATION_DURATION_MIN,
  formatDurationMin,
  officialHalfStats,
  periodLabel,
  shortPlayerName,
  totalPlayedTimeLabel,
  type OfficialHalfSlice,
} from '@/lib/matchData';
import { coachForTeam } from '@/lib/wcCoaches';
import type { LineupPlayer, LiveScoreState, MatchEvent, MatchEventKind } from '@/lib/types';

type Tab = 'overview' | 'stats' | 'lineups' | 'events' | 'scorers';

function TeamBadge({
  name,
  align = 'left',
  size = 'md',
}: {
  name: string;
  align?: 'left' | 'right';
  size?: 'sm' | 'md' | 'lg';
}) {
  const flagSize = size === 'lg' ? 40 : size === 'sm' ? 22 : 28;
  const text =
    size === 'lg' ? 'text-base sm:text-lg' : size === 'sm' ? 'text-xs' : 'text-sm sm:text-base';
  return (
    <span
      className={`inline-flex min-w-0 items-center gap-2 font-bold ${text} ${
        align === 'right' ? 'flex-row-reverse text-right' : 'text-left'
      }`}
    >
      <CountryFlag team={name} size={flagSize} />
      <span className="truncate">{name}</span>
    </span>
  );
}

function HalfScoreChip({
  title,
  half,
  homeTeam,
  awayTeam,
}: {
  title: string;
  half: OfficialHalfSlice;
  homeTeam: string;
  awayTeam: string;
}) {
  return (
    <div className="rounded-xl border border-edge bg-raised/40 px-4 py-4 text-center">
      <p className="text-[10px] font-black uppercase tracking-widest text-muted">{title}</p>
      <p className="mt-2 flex items-center justify-center gap-2.5 font-mono text-2xl font-black tabular-nums sm:text-3xl">
        <CountryFlag team={homeTeam} size={22} />
        <span>
          {half.homeGoals}
          <span className="mx-1 text-muted">–</span>
          {half.awayGoals}
        </span>
        <CountryFlag team={awayTeam} size={22} />
      </p>
    </div>
  );
}

/** Clean half-by-half table from official Score feed only. */
function ByHalfPanel({
  score,
  homeTeam,
  awayTeam,
}: {
  score: LiveScoreState;
  homeTeam: string;
  awayTeam: string;
}) {
  const { h1, h2 } = useMemo(() => officialHalfStats(score), [score]);

  const rows: {
    key: string;
    label: string;
    icon?: 'yellow' | 'red';
    h1Home: number;
    h1Away: number;
    h2Home: number;
    h2Away: number;
  }[] = [
    {
      key: 'goals',
      label: 'Goals',
      h1Home: h1.homeGoals,
      h1Away: h1.awayGoals,
      h2Home: h2.homeGoals,
      h2Away: h2.awayGoals,
    },
    {
      key: 'corners',
      label: 'Corners',
      h1Home: h1.homeCorners,
      h1Away: h1.awayCorners,
      h2Home: h2.homeCorners,
      h2Away: h2.awayCorners,
    },
    {
      key: 'yellow',
      label: 'Yellow cards',
      icon: 'yellow',
      h1Home: h1.homeYellows,
      h1Away: h1.awayYellows,
      h2Home: h2.homeYellows,
      h2Away: h2.awayYellows,
    },
    {
      key: 'red',
      label: 'Red cards',
      icon: 'red',
      h1Home: h1.homeReds,
      h1Away: h1.awayReds,
      h2Home: h2.homeReds,
      h2Away: h2.awayReds,
    },
  ];

  return (
    <section className="overflow-hidden rounded-2xl border border-edge bg-surface/80">
      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-edge px-4 py-3 sm:px-5">
        <div>
          <h3 className="font-display text-base font-extrabold uppercase tracking-wide">
            By half
          </h3>
          <p className="mt-0.5 text-[11px] text-muted">
            Official Score feed · first half vs second half
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs font-bold text-muted">
          <span className="inline-flex items-center gap-1.5">
            <CountryFlag team={homeTeam} size={14} />
            {homeTeam}
          </span>
          <span className="text-edge">·</span>
          <span className="inline-flex items-center gap-1.5">
            <CountryFlag team={awayTeam} size={14} />
            {awayTeam}
          </span>
        </div>
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
        <HalfScoreChip title="First half" half={h1} homeTeam={homeTeam} awayTeam={awayTeam} />
        <HalfScoreChip title="Second half" half={h2} homeTeam={homeTeam} awayTeam={awayTeam} />
      </div>

      <div className="border-t border-edge">
        <div className="grid grid-cols-[1fr_7rem_7rem] gap-2 border-b border-edge bg-raised/40 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-muted sm:grid-cols-[1fr_9rem_9rem] sm:px-5">
          <span>Stat</span>
          <span className="text-center">1st half</span>
          <span className="text-center">2nd half</span>
        </div>
        {rows.map((r) => (
          <div
            key={r.key}
            className="grid grid-cols-[1fr_7rem_7rem] items-center gap-2 border-b border-edge/60 px-4 py-3 last:border-b-0 sm:grid-cols-[1fr_9rem_9rem] sm:px-5"
          >
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-ink/90">
              {r.icon === 'yellow' ? (
                <CardGlyph color="yellow" size="sm" />
              ) : r.icon === 'red' ? (
                <CardGlyph color="red" size="sm" />
              ) : null}
              {r.label}
            </span>
            <span className="text-center font-mono text-sm font-black tabular-nums sm:text-base">
              {r.h1Home}
              <span className="mx-1 text-muted">–</span>
              {r.h1Away}
            </span>
            <span className="text-center font-mono text-sm font-black tabular-nums sm:text-base">
              {r.h2Home}
              <span className="mx-1 text-muted">–</span>
              {r.h2Away}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

/** World Cup scoreboard tile: Half-time / Full time. */
function ScorePhaseCard({
  title,
  homeGoals,
  awayGoals,
  homeTeam,
  awayTeam,
  added,
  hint,
  emphasize,
}: {
  title: string;
  homeGoals: number;
  awayGoals: number;
  homeTeam: string;
  awayTeam: string;
  added: number | null;
  hint?: string;
  emphasize?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border px-3 py-3 text-center ${
        emphasize
          ? 'border-pitch-600/40 bg-pitch-500/10'
          : 'border-edge bg-raised/50'
      }`}
    >
      <p className="text-[10px] font-black uppercase tracking-wider text-muted">{title}</p>
      <p className="mt-2 flex items-center justify-center gap-2 font-mono text-2xl font-black tabular-nums">
        <CountryFlag team={homeTeam} size={22} />
        <span>
          {homeGoals}–{awayGoals}
        </span>
        <CountryFlag team={awayTeam} size={22} />
      </p>
      {added != null && added > 0 ? (
        <p className="mt-1.5 text-xs font-semibold text-pitch-400">
          +{added} min stoppage
        </p>
      ) : (
        <p className="mt-1.5 text-[10px] leading-snug text-muted">
          {hint ?? 'FIFA stoppage time applies'}
        </p>
      )}
    </div>
  );
}

const EVENT_FILTERS: { id: 'all' | MatchEventKind; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'goal', label: 'Goals' },
  { id: 'card', label: 'Cards' },
  { id: 'sub', label: 'Subs' },
  { id: 'hydration', label: 'Hydration' },
  { id: 'corner', label: 'Corners' },
  { id: 'freekick', label: 'Free kicks' },
  { id: 'offside', label: 'Offsides' },
  { id: 'var', label: 'VAR' },
  { id: 'shot', label: 'Shots' },
];

export function MatchCentre({
  homeTeam,
  awayTeam,
  score,
  events,
  hasData,
  feedState,
  compact,
  competition,
  kickoffTs,
}: {
  homeTeam: string;
  awayTeam: string;
  score: LiveScoreState;
  events: MatchEvent[];
  hasData: boolean;
  feedState: 'connecting' | 'reconnecting' | 'open' | 'closed' | 'error';
  compact?: boolean;
  competition?: string | null;
  kickoffTs?: number | null;
}) {
  const [tab, setTab] = useState<Tab>('stats');
  const [filter, setFilter] = useState<'all' | MatchEventKind>('all');
  const phase = periodLabel(score.period, score.gameState);
  const kickoffLabel =
    kickoffTs && Number.isFinite(kickoffTs)
      ? new Date(kickoffTs).toLocaleString(undefined, {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        })
      : null;
  const statusLine = score.finalised
    ? 'Full time'
    : score.statusId && score.statusId > 1
      ? 'Live now'
      : hasData
        ? phase
        : 'Waiting for kick-off';

  const activeFilter = useMemo<'all' | MatchEventKind>(() => {
    if (filter === 'all') return 'all';
    return events.some((e) => e.kind === filter) ? filter : 'all';
  }, [events, filter]);

  const filtered = useMemo(() => {
    const list =
      activeFilter === 'all' ? events : events.filter((e) => e.kind === activeFilter);
    return [...list].reverse();
  }, [events, activeFilter]);

  const scoreAtGoal = useMemo(() => runningScoresByGoalId(events), [events]);

  const visibleFilters = useMemo(() => {
    const counts = new Map<MatchEventKind, number>();
    for (const e of events) {
      counts.set(e.kind, (counts.get(e.kind) ?? 0) + 1);
    }
    return EVENT_FILTERS.filter((f) => f.id === 'all' || (counts.get(f.id) ?? 0) > 0);
  }, [events]);

  // Official Score / Stats map only — no incomplete event tallies.
  const keyTiles: {
    label: string;
    icon: string;
    home: number;
    away: number;
  }[] = [
    { label: 'Goals', icon: '⚽', home: score.stats.homeGoals, away: score.stats.awayGoals },
    { label: 'Corners', icon: '🚩', home: score.stats.homeCorners, away: score.stats.awayCorners },
    { label: 'Yellows', icon: 'yellow', home: score.stats.homeYellows, away: score.stats.awayYellows },
    { label: 'Reds', icon: 'red', home: score.stats.homeReds, away: score.stats.awayReds },
  ];

  return (
    <div className={compact ? '' : 'overflow-hidden'}>
      <div className={`text-center ${compact ? 'px-5 py-5' : 'px-5 py-6 sm:px-6'}`}>
        {hasData ? (
          <>
            <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-muted">
              {statusLine}
              {score.minute && !score.finalised ? ` · ${score.minute}` : ''}
            </p>
            <div className="flex items-center justify-center gap-3 sm:gap-5">
              <div className="min-w-0 flex-1">
                <TeamBadge name={homeTeam} align="right" size="lg" />
              </div>
              <p className="shrink-0 font-mono text-4xl font-black tabular-nums tracking-tight sm:text-5xl">
                {score.homeGoals}
                <span className="mx-1.5 text-muted">–</span>
                {score.awayGoals}
              </p>
              <div className="min-w-0 flex-1">
                <TeamBadge name={awayTeam} align="left" size="lg" />
              </div>
            </div>
            <p className="mt-2 text-xs text-muted">
              {phase}
              {score.finalised
                ? score.addedTimeH2 != null
                  ? ` · 90+${score.addedTimeH2} played`
                  : ''
                : score.addedTime != null
                  ? ` · +${score.addedTime} announced`
                  : ''}
            </p>

            {/* Venue + competition meta (broadcast-style) */}
            <div className="mt-3 space-y-1 text-center text-xs">
              {score.venue && (
                <p>
                  <span className="font-semibold text-pitch-400">Venue:</span>{' '}
                  <span className="text-ink/85">{score.venue}</span>
                </p>
              )}
              {(competition || kickoffLabel) && (
                <p className="text-muted">
                  {competition ? <span className="text-ink/80">{competition}</span> : null}
                  {competition && kickoffLabel ? ' · ' : ''}
                  {kickoffLabel}
                </p>
              )}
              {(score.weather || score.pitch) && (
                <p className="text-[11px] text-muted">
                  {[score.weather, score.pitch].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>

            {/* FIFA World Cup: half-time score vs full-time score */}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <ScorePhaseCard
                title="Half-time"
                homeGoals={
                  score.ht.homeGoals + score.ht.awayGoals > 0
                    ? score.ht.homeGoals
                    : score.h1.homeGoals
                }
                awayGoals={
                  score.ht.homeGoals + score.ht.awayGoals > 0
                    ? score.ht.awayGoals
                    : score.h1.awayGoals
                }
                homeTeam={homeTeam}
                awayTeam={awayTeam}
                added={score.addedTimeH1}
                hint={
                  score.addedTimeH1 == null
                    ? 'After 45′ + 1st-half stoppage (FIFA)'
                    : 'Score after 1st-half stoppage'
                }
              />
              <ScorePhaseCard
                title={score.finalised ? 'Full time' : 'Current score'}
                homeGoals={score.homeGoals}
                awayGoals={score.awayGoals}
                homeTeam={homeTeam}
                awayTeam={awayTeam}
                added={score.finalised ? score.addedTimeH2 : score.addedTime}
                hint={
                  score.finalised
                    ? 'After 90′ + 2nd-half stoppage'
                    : 'Live · stoppage still to come'
                }
                emphasize={score.finalised}
              />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
              {keyTiles.map((s) => (
                <div
                  key={s.label}
                  className="rounded-xl border border-edge bg-raised/40 px-2 py-2.5 text-center"
                >
                  <p className="flex items-center justify-center gap-1.5 text-[10px] font-bold text-muted">
                    {s.icon === 'yellow' ? (
                      <CardGlyph color="yellow" size="sm" />
                    ) : s.icon === 'red' ? (
                      <CardGlyph color="red" size="sm" />
                    ) : (
                      <span aria-hidden>{s.icon}</span>
                    )}
                    {s.label}
                  </p>
                  <p className="mt-1.5 flex items-center justify-center gap-1.5 font-mono text-sm font-black tabular-nums">
                    <CountryFlag team={homeTeam} size={16} />
                    <span>
                      {s.home}–{s.away}
                    </span>
                    <CountryFlag team={awayTeam} size={16} />
                  </p>
                </div>
              ))}
            </div>

            {score.stats.varChecks > 0 && (
              <p className="mt-3 text-xs font-semibold text-muted">
                📺 VAR checked {score.stats.varChecks} time
                {score.stats.varChecks === 1 ? '' : 's'} this match
              </p>
            )}
          </>
        ) : (
          <p className="py-6 text-sm text-muted">
            Match stats will appear here once the game starts
            {feedState !== 'open' ? ' (reconnecting to the live feed…)' : '…'}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-1 border-t border-edge px-4 pt-3 sm:px-5">
        {(
          [
            ['stats', 'Stats'],
            ['lineups', 'Lineups'],
            ['events', `Events${events.length ? ` (${events.length})` : ''}`],
            ['overview', 'Match info'],
            ['scorers', 'Players scored'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-t-lg px-3 py-2 text-[11px] font-bold uppercase tracking-wider transition-colors ${
              tab === id ? 'bg-raised text-pitch-400' : 'text-muted hover:text-ink'
            }`}
          >
            {label}
          </button>
        ))}
        {(() => {
          const finished =
            score.finalised ||
            score.statusId === 5 ||
            score.statusId === 10 ||
            score.statusId === 13 ||
            score.statusId === 100;
          const notStarted =
            !finished && (score.statusId == null || score.statusId <= 1 || !hasData);
          const inPlay = !finished && !notStarted;
          const label = finished
            ? '● Full time'
            : notStarted
              ? '○ Not started'
              : feedState === 'open'
                ? '● Live'
                : '○ Offline';
          const live = inPlay && feedState === 'open';
          return (
            <span
              className={`ml-auto self-center text-[10px] font-bold ${
                live ? 'text-pitch-400' : 'text-muted'
              }`}
            >
              {label}
            </span>
          );
        })()}
      </div>

      {tab === 'stats' && (
        <div className="border-t border-edge p-4 sm:p-5">
          {!hasData ? (
            <p className="py-6 text-center text-sm text-muted">No stats yet — check back at kick-off.</p>
          ) : (
            <div className="space-y-5">
              <TeamStatsBroadcast
                homeTeam={homeTeam}
                awayTeam={awayTeam}
                stats={score.stats}
              />
              <ByHalfPanel score={score} homeTeam={homeTeam} awayTeam={awayTeam} />
            </div>
          )}
          <p className="mt-5 text-center text-xs leading-relaxed text-muted">
            All figures above come from the official TxLINE Score feed (totals and per-half).
            Incomplete event tallies (throw-ins, shots, free kicks) are not shown.
          </p>
        </div>
      )}

      {tab === 'lineups' && (
        <div className="border-t border-edge p-4 sm:p-5">
          <p className="mb-3 text-xs text-muted">
            Starting XI from the live feed — shirt numbers, formation from positions, plus goals /
            cards / subs when known. Player photos and ratings are not in TxLINE.
          </p>
          <LineupPitch
            homeTeam={homeTeam}
            awayTeam={awayTeam}
            home={score.lineups.home}
            away={score.lineups.away}
          />
        </div>
      )}

      {tab === 'overview' && (
        <div className="space-y-3 border-t border-edge p-4 sm:p-5">
          {score.venue && (
            <p className="rounded-xl border border-edge bg-raised/40 px-4 py-3 text-center text-sm">
              <span className="font-semibold text-pitch-400">Venue:</span>{' '}
              <span className="font-semibold text-ink/90">{score.venue}</span>
            </p>
          )}
          <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
            {[
              ['Total time', totalPlayedTimeLabel(score)],
              ['Competition', competition ?? '—'],
              ['Kick-off', kickoffLabel ?? '—'],
              [
                '1st half stoppage',
                score.addedTimeH1 != null
                  ? `+${score.addedTimeH1} min`
                  : 'Applies (not in feed yet)',
              ],
              [
                '2nd half stoppage',
                score.addedTimeH2 != null
                  ? `+${score.addedTimeH2} min`
                  : 'Applies (not in feed yet)',
              ],
              [
                'Hydration breaks',
                score.hydrationBreaks.length
                  ? score.hydrationBreaks
                      .map(
                        (b) =>
                          `${b.minute} · ${formatDurationMin(b.durationMin)}${
                            b.observed ? '' : ' (scheduled)'
                          }`,
                      )
                      .join(' · ')
                  : `22′ & 67′ · ${formatDurationMin(FIFA_HYDRATION_DURATION_MIN)} each`,
              ],
              ['Coverage', score.coverage ?? '—'],
              ['Weather', score.weather ?? '—'],
              ['Pitch', score.pitch ?? '—'],
              ['VAR checks', String(score.stats.varChecks)],
              [
                'Formations',
                [
                  score.lineups.home?.formation,
                  score.lineups.away?.formation,
                ]
                  .filter(Boolean)
                  .join(' vs ') || '—',
              ],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl border border-edge bg-raised/40 px-3 py-2">
                <dt className="text-[10px] font-black uppercase tracking-wider text-muted">{k}</dt>
                <dd className="mt-0.5 font-semibold capitalize">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {tab === 'events' && (
        <div className="border-t border-edge p-4 sm:p-5">
          <p className="mb-3 text-xs text-muted">
            Match timeline — newest first.
          </p>
          <div className="mb-3 flex flex-wrap gap-1">
            {visibleFilters.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={`rounded-lg border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                  activeFilter === f.id
                    ? 'border-pitch-600/50 bg-pitch-500/15 text-pitch-400'
                    : 'border-edge text-muted hover:text-ink'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">
              Nothing in this filter yet. Goals, cards, shots and free kicks show up as the match
              unfolds.
            </p>
          ) : (
            <ul className="max-h-[28rem] space-y-2 overflow-y-auto overscroll-contain pr-1">
              {filtered.map((ev) => {
                const atGoal = scoreAtGoal.get(ev.id);
                return (
                  <MatchEventCard
                    key={ev.id}
                    ev={ev}
                    homeTeam={homeTeam}
                    awayTeam={awayTeam}
                    homeGoals={atGoal?.home ?? score.homeGoals}
                    awayGoals={atGoal?.away ?? score.awayGoals}
                  />
                );
              })}
            </ul>
          )}
        </div>
      )}

      {tab === 'scorers' && (
        <div className="space-y-6 border-t border-edge p-4 sm:p-5">
          {/* Players who scored */}
          <section>
            <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-muted">
              Players scored
            </p>
            {score.players.filter((p) => p.goals > 0).length === 0 ? (
              <p className="text-sm text-muted">No goals credited to players yet.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {(['home', 'away'] as const).map((side) => {
                  const list = score.players.filter((p) => p.team === side && p.goals > 0);
                  const name = side === 'home' ? homeTeam : awayTeam;
                  return (
                    <div key={`scored-${side}`}>
                      <div className="mb-2">
                        <TeamBadge name={name} size="sm" />
                      </div>
                      {list.length === 0 ? (
                        <p className="text-xs text-muted">No scorers</p>
                      ) : (
                        <ul className="flex flex-col gap-1.5">
                          {list.map((p) => (
                            <li
                              key={`g-${side}-${p.playerId}`}
                              className="flex items-center justify-between rounded-lg border border-edge bg-raised/40 px-3 py-2 text-sm"
                            >
                              <span className="text-xs font-semibold">
                                {p.name ?? `Player #${p.playerId}`}
                              </span>
                              <span className="text-xs font-semibold">⚽ {p.goals}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Full squad: coach + XI + bench */}
          <section>
            <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-muted">
              Full squad
            </p>
            {!score.lineups.home && !score.lineups.away ? (
              <p className="text-sm text-muted">
                Lineups will appear here when the feed publishes them.
              </p>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2">
                {(['home', 'away'] as const).map((side) => {
                  const lineup = score.lineups[side];
                  const name = side === 'home' ? homeTeam : awayTeam;
                  const coach = lineup?.coach ?? coachForTeam(name);
                  return (
                    <div key={`squad-${side}`} className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <TeamBadge name={name} size="sm" />
                        {lineup?.formation ? (
                          <span className="rounded-full bg-pitch-500/15 px-2 py-0.5 text-[10px] font-black text-pitch-400">
                            {lineup.formation}
                          </span>
                        ) : null}
                      </div>

                      <p className="rounded-lg border border-edge bg-raised/50 px-3 py-2 text-sm">
                        <span className="text-[10px] font-black uppercase tracking-wider text-muted">
                          Coach
                        </span>
                        <span className="mt-0.5 block font-semibold">
                          {coach ?? 'Not in feed'}
                        </span>
                      </p>

                      {!lineup ? (
                        <p className="text-xs text-muted">Waiting for lineup…</p>
                      ) : (
                        <>
                          <SquadList title="Starting XI" players={lineup.starters} />
                          <SquadList title="Bench" players={lineup.bench} />
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function SquadList({ title, players }: { title: string; players: LineupPlayer[] }) {
  if (!players.length) {
    return (
      <div>
        <p className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-muted">
          {title}
        </p>
        <p className="text-xs text-muted">—</p>
      </div>
    );
  }
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-muted">
        {title}
      </p>
      <ul className="flex flex-col gap-1">
        {players.map((p) => (
          <li
            key={p.playerId}
            className="flex items-center justify-between gap-2 rounded-lg border border-edge bg-raised/40 px-3 py-1.5 text-sm"
          >
            <span className="min-w-0 truncate">
              <span className="font-mono text-[11px] text-muted">
                {p.shirt ?? '—'}
              </span>{' '}
              <span className="text-xs font-semibold">
                {shortPlayerName(p.name)}
              </span>
              {p.subbedOff ? (
                <span className="ml-1 text-[10px] text-rose-400" title="Subbed off">
                  ↓
                </span>
              ) : null}
              {p.subbedOn ? (
                <span className="ml-1 text-[10px] text-pitch-400" title="Subbed on">
                  ↑
                </span>
              ) : null}
            </span>
            <span className="inline-flex shrink-0 items-center gap-1.5 text-[11px] font-semibold">
              {p.goals > 0 ? <span>⚽{p.goals > 1 ? p.goals : ''}</span> : null}
              {p.yellowCards > 0 ? <CardGlyph color="yellow" size="sm" /> : null}
              {p.redCards > 0 ? <CardGlyph color="red" size="sm" /> : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
