'use client';

import { useLiveScore } from '@/hooks/useLiveScore';
import { conditionStatusText, evaluateCondition } from '@/lib/conditions';
import type { CommitmentStatus } from '@/lib/types';

/**
 * Live in-play card (FR-15): live score via the keeper score proxy,
 * plain-language condition status, and a match event log.
 *
 * "Resolved" is driven exclusively by `resolvedOnChain` (a `resolved` feed
 * event or an on-chain terminal status) — never inferred from score data
 * alone (FR-15.5).
 */
export function InPlayCard({
  fixtureId,
  template,
  param,
  homeTeam,
  awayTeam,
  status,
  resolvedOnChain,
}: {
  fixtureId: number;
  template: number;
  param: number;
  homeTeam?: string;
  awayTeam?: string;
  status: CommitmentStatus;
  resolvedOnChain: boolean;
}) {
  const { score, events, state, hasData } = useLiveScore(fixtureId);
  const home = homeTeam ?? 'Home';
  const away = awayTeam ?? 'Away';

  const liveState = evaluateCondition(template, param, score.homeGoals, score.awayGoals);
  const displayState: 'tracking' | 'met' | 'resolved' = resolvedOnChain
    ? 'resolved'
    : liveState;

  const resolvedLine =
    status === 'Executed'
      ? 'Resolved · Condition met — vault paid to beneficiary'
      : status === 'Refunded'
        ? 'Resolved · Condition not met — your pledge is refundable'
        : status === 'Void'
          ? 'Void — deposits are reclaimable'
          : 'Resolved on-chain';

  return (
    <section className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-edge bg-raised/60 px-5 py-3">
        <h2 className="text-xs font-black uppercase tracking-wider">In play</h2>
        <span
          className={`inline-flex items-center gap-1.5 text-[11px] font-bold ${
            state === 'open' ? 'text-pitch-400' : 'text-amber-400'
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              state === 'open' ? 'bg-pitch-400' : 'animate-pulse bg-amber-400'
            }`}
          />
          {state === 'open' ? 'LIVE FEED' : 'Reconnecting…'}
        </span>
      </div>

      {/* LiveScore */}
      <div className="px-5 py-6 text-center">
        {hasData ? (
          <>
            <p className="font-mono text-5xl font-black tabular-nums tracking-tight">
              {score.homeGoals}
              <span className="mx-2 text-muted">–</span>
              {score.awayGoals}
            </p>
            <p className="mt-2 text-sm font-semibold text-muted">
              {home} vs {away}
              {score.minute ? ` · ${score.minute}'` : ''}
              {score.finalised ? ' · FT' : ''}
            </p>
          </>
        ) : (
          <p className="py-4 text-sm text-muted">
            Waiting for live score data{state !== 'open' ? ' — reconnecting to the score feed…' : '…'}
          </p>
        )}
      </div>

      {/* ConditionStatus */}
      <div
        className={`mx-5 mb-5 rounded-xl border px-4 py-3 text-sm font-semibold ${
          displayState === 'resolved'
            ? status === 'Executed'
              ? 'border-gold-500/40 bg-gold-500/10 text-gold-300'
              : 'border-amber-500/40 bg-amber-500/10 text-amber-400'
            : displayState === 'met'
              ? 'border-pitch-600/50 bg-pitch-500/10 text-pitch-400'
              : 'border-edge bg-raised text-muted'
        }`}
      >
        <span className="mr-2 text-[10px] font-black uppercase tracking-widest opacity-80">
          {displayState === 'resolved' ? 'Resolved' : displayState === 'met' ? 'Met' : 'Tracking'}
        </span>
        {displayState === 'resolved'
          ? resolvedLine
          : conditionStatusText(template, param, score.homeGoals, score.awayGoals, home, away) +
            (hasData ? ` · ${score.homeGoals}–${score.awayGoals}${score.minute ? ` (${score.minute}')` : ''}` : '')}
      </div>

      {/* EventLog */}
      <div className="border-t border-edge px-5 py-4">
        <h3 className="mb-2 text-[10px] font-black uppercase tracking-widest text-muted">
          Match events
        </h3>
        {events.length === 0 ? (
          <p className="text-xs text-muted">No events yet — goals and cards appear here as they happen.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {events.map((ev) => (
              <li key={ev.id} className="flex items-baseline gap-2 text-xs">
                <span className="w-10 shrink-0 font-mono font-bold text-muted">
                  {ev.minute ? `${ev.minute}'` : '—'}
                </span>
                <span aria-hidden>{ev.kind === 'goal' ? '⚽' : ev.kind === 'card' ? '🟨' : 'ℹ️'}</span>
                <span className="text-ink/90">
                  {ev.kind === 'goal' && ev.team
                    ? ev.label.replace('home team', home).replace('away team', away)
                    : ev.label}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
