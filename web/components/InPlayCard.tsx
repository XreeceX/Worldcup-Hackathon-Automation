'use client';

import Link from 'next/link';
import { CountryFlag } from '@/components/CountryFlag';
import { useLiveScore } from '@/hooks/useLiveScore';
import { conditionStatusText, evaluateCondition } from '@/lib/conditions';
import { isPledgeResultsPending } from '@/lib/fixtures';
import type { CommitmentStatus } from '@/lib/types';

/**
 * Compact match summary on a commitment page (FR-15).
 * Full stats live on the fixture page — this only links there.
 *
 * "Resolved" is driven exclusively by `resolvedOnChain` — never inferred from
 * score data alone (FR-15.5).
 */
export function InPlayCard({
  fixtureId,
  template,
  param,
  homeTeam,
  awayTeam,
  status,
  resolvedOnChain,
  kickoffTs,
}: {
  fixtureId: number;
  template: number;
  param: number;
  homeTeam?: string;
  awayTeam?: string;
  status: CommitmentStatus;
  resolvedOnChain: boolean;
  competition?: string | null;
  kickoffTs?: number | null;
}) {
  const { score, events, state, hasData } = useLiveScore(fixtureId);
  const home = homeTeam ?? 'Home';
  const away = awayTeam ?? 'Away';

  const liveState = evaluateCondition(
    template,
    param,
    score.homeGoals,
    score.awayGoals,
    score.stats.homePens,
    score.stats.awayPens,
  );
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

  const finished =
    score.finalised ||
    score.statusId === 5 ||
    score.statusId === 10 ||
    score.statusId === 13 ||
    score.statusId === 100;
  const resultsPending =
    !resolvedOnChain &&
    kickoffTs != null &&
    isPledgeResultsPending(
      { kickoffTs, gameState: score.statusId ?? 0, status: finished ? 'finished' : undefined },
      { finalised: score.finalised, statusId: score.statusId },
    );
  const notStarted =
    !finished && (score.statusId == null || score.statusId <= 1 || !hasData);
  const inPlay = !finished && !notStarted;
  const feedLabel = finished
    ? 'Match ended'
    : notStarted
      ? 'Not started'
      : state === 'open'
        ? 'Live'
        : 'Reconnecting…';

  return (
    <section className="card overflow-hidden">
      <Link
        href={`/fixture/${fixtureId}`}
        className="flex w-full flex-col gap-4 px-5 py-5 text-left transition-colors hover:bg-raised/40 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-6"
      >
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted">
            Match details
          </p>
          <p className="mt-1.5 flex flex-wrap items-center gap-2 text-lg font-black tracking-tight sm:text-xl">
            <span className="inline-flex items-center gap-1.5">
              <CountryFlag team={home} size={22} />
              {home}
            </span>
            <span className="font-mono text-pitch-400">
              {hasData ? `${score.homeGoals}–${score.awayGoals}` : 'vs'}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CountryFlag team={away} size={22} />
              {away}
            </span>
          </p>
          <p className="mt-1 text-xs text-muted">
            {finished
              ? 'Full time · open fixture for stats, lineups & events'
              : inPlay
                ? `In play${score.minute ? ` · ${score.minute}` : ''} · open fixture for full match centre`
                : 'Open fixture for stats, lineups & events'}
            {' · '}
            <span className={inPlay && state === 'open' ? 'text-pitch-400' : ''}>
              {feedLabel}
            </span>
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-pitch-500 px-5 py-3 text-sm font-bold text-ink shadow-sm shadow-pitch-900/30">
          View fixture
          <span aria-hidden>→</span>
        </span>
      </Link>

      <div
        className={`mx-5 mb-5 rounded-xl border px-4 py-3 text-sm font-semibold ${
          displayState === 'resolved'
            ? status === 'Executed'
              ? 'border-gold-500/40 bg-gold-500/10 text-gold-300'
              : 'border-amber-500/40 bg-amber-500/10 text-amber-400'
            : resultsPending
              ? 'border-amber-500/40 bg-amber-500/10 text-amber-200'
              : displayState === 'met'
                ? 'border-pitch-600/50 bg-pitch-500/10 text-pitch-400'
                : 'border-edge bg-raised text-muted'
        }`}
      >
        <span className="mr-2 text-[10px] font-black uppercase tracking-widest opacity-80">
          {displayState === 'resolved'
            ? 'Resolved'
            : resultsPending
              ? 'Results pending'
              : displayState === 'met'
                ? 'Met'
                : 'Tracking'}
        </span>
        {displayState === 'resolved'
          ? resolvedLine
          : resultsPending
            ? `Full time ${score.homeGoals}–${score.awayGoals} is final — settlement proof may take a few minutes. Match centre stays accurate.`
            : conditionStatusText(
                template,
                param,
                score.homeGoals,
                score.awayGoals,
                home,
                away,
                score.stats.homePens,
                score.stats.awayPens,
                score.minute ? `(${score.minute})` : inPlay ? '(LIVE)' : '',
              )}
      </div>

      {!resolvedOnChain && events.length > 0 && (
        <div className="mx-5 mb-5 flex flex-col gap-1 border-t border-edge/60 pt-3 text-left text-xs text-muted">
          {events
            .filter((e) =>
              ['goal', 'card', 'period'].includes(e.kind),
            )
            .slice(-6)
            .map((e) => (
              <div key={e.id} className="flex gap-2">
                <span className="shrink-0 font-mono text-muted/70">
                  {e.minute ?? '—'}
                </span>
                <span>
                  {e.kind === 'goal' ? '⚽ ' : ''}
                  {e.label}
                </span>
              </div>
            ))}
        </div>
      )}
    </section>
  );
}
