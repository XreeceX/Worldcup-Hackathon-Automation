'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { DelayedDataBanner } from '@/components/Banner';
import { CommitmentCard } from '@/components/CommitmentCard';
import { CreateCommitmentForm } from '@/components/CreateCommitmentForm';
import { EmptyState, LoadingGrid } from '@/components/EmptyState';
import { FixtureHeader } from '@/components/FixtureHeader';
import { fetchBoard, fetchFixtures } from '@/lib/api';
import type { BoardCommitment, Fixture } from '@/lib/types';

export default function FixturePage() {
  const params = useParams<{ id: string }>();
  const fixtureId = Number(params.id);

  const [fixture, setFixture] = useState<Fixture | null>(null);
  const [commitments, setCommitments] = useState<BoardCommitment[]>([]);
  const [loading, setLoading] = useState(true);
  const [indexerDown, setIndexerDown] = useState(false);

  useEffect(() => {
    if (!Number.isFinite(fixtureId)) return;
    let cancelled = false;
    const load = async () => {
      const [fixturesRes, boardRes] = await Promise.allSettled([
        fetchFixtures(),
        fetchBoard({ fixtureId }),
      ]);
      if (cancelled) return;
      if (fixturesRes.status === 'fulfilled') {
        setFixture(fixturesRes.value.find((f) => f.fixtureId === fixtureId) ?? null);
      }
      if (boardRes.status === 'fulfilled') {
        setCommitments(boardRes.value.filter((c) => c.fixtureId === fixtureId));
        setIndexerDown(false);
      } else {
        setIndexerDown(true);
      }
      setLoading(false);
    };
    load();
    const timer = setInterval(load, 20_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [fixtureId]);

  // Fall back to a placeholder fixture so the create flow still works when the
  // indexer is down — kickoff unknown, so creation is disabled in that case.
  const effectiveFixture = useMemo<Fixture | null>(() => {
    if (fixture) return fixture;
    return null;
  }, [fixture]);

  if (!Number.isFinite(fixtureId)) {
    return <EmptyState title="Unknown fixture" body="That fixture id is not valid." />;
  }

  return (
    <div>
      <Link href="/" className="mb-4 inline-block text-sm font-semibold text-muted hover:text-ink">
        ← Back to board
      </Link>

      <DelayedDataBanner visible={indexerDown} />

      {loading ? (
        <div className="card mb-8 h-32 animate-pulse bg-raised/50" />
      ) : effectiveFixture ? (
        <FixtureHeader fixture={effectiveFixture} />
      ) : (
        <EmptyState
          title="Fixture not found"
          body="This fixture isn't in the indexer's fixture list. If the indexer is down, fixture metadata is temporarily unavailable — commitments on-chain are unaffected."
        />
      )}

      <div className="grid items-start gap-8 lg:grid-cols-[1fr_26rem]">
        <section>
          <h2 className="mb-4 text-xs font-black uppercase tracking-wider text-muted">
            Commitments on this match
          </h2>
          {loading ? (
            <LoadingGrid count={2} />
          ) : commitments.length === 0 ? (
            <EmptyState
              icon="🎯"
              title="No commitments yet"
              body="Nobody has locked a pledge on this match. Use the form to be first — create solo or open it up as a Fan DAO."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {commitments.map((c) => (
                <CommitmentCard key={c.pubkey} commitment={c} fixture={effectiveFixture ?? undefined} />
              ))}
            </div>
          )}
        </section>

        <section>
          {effectiveFixture ? (
            <CreateCommitmentForm fixture={effectiveFixture} />
          ) : (
            !loading && (
              <div className="card p-6 text-sm text-muted">
                Creating a commitment needs the fixture&apos;s kickoff time,
                which couldn&apos;t be loaded right now.
              </div>
            )
          )}
        </section>
      </div>
    </div>
  );
}
