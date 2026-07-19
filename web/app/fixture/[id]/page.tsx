'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { EmptyState } from '@/components/EmptyState';
import { FixtureHeader } from '@/components/FixtureHeader';
import { MatchDetails } from '@/components/MatchDetails';
import { useLiveScore } from '@/hooks/useLiveScore';
import { fetchBoard, fetchFixtures } from '@/lib/api';
import type { BoardCommitment, Fixture } from '@/lib/types';

/** Match centre for one fixture — pledges live on the Board (`/`). */
export default function FixturePage() {
  const params = useParams<{ id: string }>();
  const fixtureId = Number(params.id);

  const [fixture, setFixture] = useState<Fixture | null>(null);
  const [pledges, setPledges] = useState<BoardCommitment[] | null>(null);
  const [loading, setLoading] = useState(true);
  const live = useLiveScore(Number.isFinite(fixtureId) ? fixtureId : null);

  useEffect(() => {
    if (!Number.isFinite(fixtureId)) return;
    let cancelled = false;
    fetchBoard({ fixtureId, limit: 200 })
      .then((rows) => {
        if (!cancelled) setPledges(rows);
      })
      .catch(() => {
        if (!cancelled) setPledges(null);
      });
    return () => {
      cancelled = true;
    };
  }, [fixtureId]);

  useEffect(() => {
    if (!Number.isFinite(fixtureId)) return;
    let cancelled = false;
    fetchFixtures()
      .then((list) => {
        if (cancelled) return;
        setFixture(list.find((f) => f.fixtureId === fixtureId) ?? null);
      })
      .catch(() => {
        if (!cancelled) setFixture(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fixtureId]);

  const effectiveFixture = useMemo(() => fixture, [fixture]);

  if (!Number.isFinite(fixtureId)) {
    return <EmptyState title="Unknown fixture" body="That fixture id is not valid." />;
  }

  return (
    <div>
      <Link
        href="/#pledge-board"
        className="mb-4 inline-block text-sm font-semibold text-muted hover:text-ink"
      >
        ← Back to pledge board
      </Link>

      {loading ? (
        <div className="card mb-8 h-32 animate-pulse bg-raised/50" />
      ) : effectiveFixture ? (
        <FixtureHeader
          fixture={effectiveFixture}
          score={live.score}
          hasData={live.hasData}
          pledges={pledges ?? undefined}
        />
      ) : (
        <EmptyState
          title="Fixture not found"
          body="This fixture isn't in the fixture list yet. Try the Board, or refresh shortly."
        />
      )}

      {effectiveFixture && (
        <section className="mb-8">
          <div className="mb-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted">
              Match centre
            </p>
            <p className="mt-0.5 text-sm text-muted">
              Stats, lineups, events & squad — from the TxLINE feed.
            </p>
          </div>
          <MatchDetails
            fixture={effectiveFixture}
            score={live.score}
            events={live.events}
            hasData={live.hasData}
            feedState={live.state}
          />
        </section>
      )}
    </div>
  );
}
