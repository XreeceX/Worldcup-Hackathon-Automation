'use client';

import { useLiveScore } from '@/hooks/useLiveScore';
import { formatKickoff } from '@/lib/format';
import type { Fixture } from '@/lib/types';

const LIVE_WINDOW_MS = 4 * 3600_000;

export function FixtureHeader({ fixture }: { fixture: Fixture }) {
  const now = Date.now();
  const maybeLive = now >= fixture.kickoffTs && now < fixture.kickoffTs + LIVE_WINDOW_MS;
  const { score, hasData } = useLiveScore(maybeLive ? fixture.fixtureId : null);
  const upcoming = now < fixture.kickoffTs;

  return (
    <section className="card mb-8 p-6 sm:p-8">
      <p className="mb-2 text-xs font-black uppercase tracking-wider text-muted">
        {fixture.competition || 'World Cup'} · {formatKickoff(fixture.kickoffTs)}
      </p>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <h1 className="text-2xl font-black tracking-tight sm:text-4xl">
          {fixture.homeTeam}
          <span className="mx-3 font-mono text-pitch-400">
            {maybeLive && hasData ? `${score.homeGoals}–${score.awayGoals}` : 'vs'}
          </span>
          {fixture.awayTeam}
        </h1>
        {maybeLive && hasData && !score.finalised && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-pitch-600/40 bg-pitch-500/15 px-3 py-1 text-xs font-bold text-pitch-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-pitch-400" />
            LIVE{score.minute ? ` ${score.minute}'` : ''}
          </span>
        )}
        {upcoming && (
          <span className="rounded-full border border-edge bg-raised px-3 py-1 text-xs font-bold text-muted">
            Kicks off {formatKickoff(fixture.kickoffTs)}
          </span>
        )}
      </div>
    </section>
  );
}
