'use client';

import { MatchCentre } from '@/components/MatchCentre';
import type { Fixture, LiveScoreState, MatchEvent } from '@/lib/types';

export function MatchDetails({
  fixture,
  score,
  events,
  hasData,
  feedState,
}: {
  fixture: Fixture;
  score: LiveScoreState;
  events: MatchEvent[];
  hasData: boolean;
  feedState: 'connecting' | 'reconnecting' | 'open' | 'closed' | 'error';
}) {
  return (
    <section className="card mb-8 overflow-hidden">
      <div className="border-b border-edge px-5 py-3 sm:px-6">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted">
          Match details
        </p>
      </div>
      <MatchCentre
        homeTeam={fixture.homeTeam}
        awayTeam={fixture.awayTeam}
        score={score}
        events={events}
        hasData={hasData}
        feedState={feedState}
        competition={fixture.competition}
        kickoffTs={fixture.kickoffTs}
      />
    </section>
  );
}
