'use client';

import { CountryFlag } from '@/components/CountryFlag';
import { CardGlyph } from '@/components/EventGlyph';
import {
  isMatchEnded,
  isPledgeResultsPending,
} from '@/lib/fixtures';
import { formatKickoff } from '@/lib/format';
import { periodLabel } from '@/lib/matchData';
import { enrichFixtureMeta } from '@/lib/wcSchedule';
import type { Fixture, LiveScoreState } from '@/lib/types';

export function FixtureHeader({
  fixture,
  score,
  hasData,
}: {
  fixture: Fixture;
  score?: LiveScoreState;
  hasData?: boolean;
}) {
  const now = Date.now();
  const upcoming = now < fixture.kickoffTs;
  const phase = score ? periodLabel(score.period, score.gameState) : '—';
  const showScore = Boolean(hasData && score);
  const meta = enrichFixtureMeta(fixture);
  const stageLine = [meta.stageLabel, meta.year ? String(meta.year) : null]
    .filter(Boolean)
    .join(' · ');

  const scoreOpts = {
    finalised: score?.finalised,
    statusId: score?.statusId,
  };
  const ended = isMatchEnded(fixture, scoreOpts, now);
  const resultsPending = isPledgeResultsPending(fixture, scoreOpts, now);

  return (
    <section className="card mb-6 overflow-hidden">
      <div className="relative px-6 py-8 text-center sm:px-8 sm:py-10 lg:px-10">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(34,197,94,0.12),transparent_55%)]"
        />
        <p className="relative mb-3 text-xs font-black uppercase tracking-wider text-muted">
          {fixture.competition || 'World Cup'}
          {stageLine ? ` · ${stageLine}` : ''}
          {' · '}
          {formatKickoff(fixture.kickoffTs)}
        </p>
        <div className="relative flex flex-col items-center gap-3">
          <h1 className="flex min-w-0 flex-wrap items-center justify-center gap-x-3 gap-y-2 font-display text-3xl font-extrabold uppercase tracking-wide sm:text-5xl">
            <span className="inline-flex items-center gap-2.5">
              <CountryFlag team={fixture.homeTeam} size={36} />
              {fixture.homeTeam}
            </span>
            <span
              className={`font-mono ${
                showScore && score!.finalised ? 'text-ink' : 'text-pitch-400'
              }`}
            >
              {showScore ? `${score!.homeGoals}–${score!.awayGoals}` : 'vs'}
            </span>
            <span className="inline-flex items-center gap-2.5">
              <CountryFlag team={fixture.awayTeam} size={36} />
              {fixture.awayTeam}
            </span>
          </h1>
          {showScore && !score!.finalised && now >= fixture.kickoffTs && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-pitch-600/40 bg-pitch-500/15 px-3 py-1 text-xs font-bold text-pitch-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-pitch-400" />
              LIVE{score!.minute ? ` ${score!.minute}'` : ''}
            </span>
          )}
          {showScore && score!.finalised && (
            <span className="rounded-full border border-edge bg-raised px-3 py-1 text-xs font-bold text-muted">
              Full time
            </span>
          )}
          {upcoming && (
            <span className="rounded-full border border-edge bg-raised px-3 py-1 text-xs font-bold text-muted">
              Kicks off {formatKickoff(fixture.kickoffTs)}
            </span>
          )}
        </div>

        {(ended || resultsPending) && (
          <div
            className={`relative mx-auto mt-5 flex max-w-xl items-start gap-3 rounded-xl border px-4 py-3 text-left font-sans ${
              resultsPending
                ? 'border-amber-500/35 bg-amber-500/10'
                : 'border-rose-500/40 bg-rose-500/10'
            }`}
          >
            <span
              aria-hidden
              className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                resultsPending ? 'bg-amber-400' : 'bg-rose-400'
              }`}
            />
            <div>
              <p
                className={`text-sm font-bold tracking-tight ${
                  resultsPending ? 'text-amber-200' : 'text-rose-300'
                }`}
              >
                {resultsPending ? 'Results pending' : 'Pledges closed'}
              </p>
              <p className="mt-0.5 text-sm leading-relaxed text-ink/75">
                {resultsPending
                  ? 'Full time is in. Resolve or claim when the TxLINE proof lands.'
                  : 'This match has ended. Resolve or claim from the Board or an open commitment.'}
              </p>
            </div>
          </div>
        )}

        {showScore && (
          <div className="relative mt-5 flex flex-wrap items-center justify-center gap-2 text-xs font-semibold text-muted">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-edge bg-raised/60 px-2.5 py-1">
              <CardGlyph color="yellow" size="sm" />
              <CountryFlag team={fixture.homeTeam} size={14} /> {score!.stats.homeYellows}–
              {score!.stats.awayYellows} <CountryFlag team={fixture.awayTeam} size={14} />
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-edge bg-raised/60 px-2.5 py-1">
              🚩 Corners <CountryFlag team={fixture.homeTeam} size={14} />{' '}
              {score!.stats.homeCorners}–{score!.stats.awayCorners}{' '}
              <CountryFlag team={fixture.awayTeam} size={14} />
            </span>
            <span className="rounded-lg border border-edge bg-raised/60 px-2.5 py-1">{phase}</span>
          </div>
        )}
      </div>
    </section>
  );
}
