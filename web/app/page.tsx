'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { DelayedDataBanner } from '@/components/Banner';
import { BoardSort, type SortKey } from '@/components/BoardSort';
import { CommitmentCard } from '@/components/CommitmentCard';
import { EmptyState, LoadingGrid } from '@/components/EmptyState';
import { FixtureFilter } from '@/components/FixtureFilter';
import { LiveFeed } from '@/components/LiveFeed';
import { fetchBoard, fetchFixtures } from '@/lib/api';
import type { BoardCommitment, Fixture } from '@/lib/types';

const REFRESH_MS = 20_000;

export default function BoardPage() {
  const [commitments, setCommitments] = useState<BoardCommitment[]>([]);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [indexerDown, setIndexerDown] = useState(false);

  const [fixtureId, setFixtureId] = useState<number | null>(null);
  const [status, setStatus] = useState('All');
  const [sort, setSort] = useState<SortKey>('total_lamports');

  const load = useCallback(async () => {
    const [boardRes, fixturesRes] = await Promise.allSettled([
      fetchBoard({
        fixtureId: fixtureId ?? undefined,
        status: status !== 'All' ? status : undefined,
        sort,
      }),
      fetchFixtures(),
    ]);
    if (boardRes.status === 'fulfilled') {
      setCommitments(boardRes.value);
      setIndexerDown(false);
    } else {
      setIndexerDown(true);
    }
    if (fixturesRes.status === 'fulfilled') setFixtures(fixturesRes.value);
  }, [fixtureId, status, sort]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    load().finally(() => {
      if (!cancelled) setLoading(false);
    });
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [load]);

  const fixtureById = useMemo(
    () => new Map(fixtures.map((f) => [f.fixtureId, f])),
    [fixtures],
  );

  // Client-side fallback filter/sort in case the indexer ignores query params.
  const visible = useMemo(() => {
    let rows = commitments;
    if (fixtureId != null) rows = rows.filter((c) => c.fixtureId === fixtureId);
    if (status !== 'All') rows = rows.filter((c) => c.status === status);
    const sorted = [...rows];
    if (sort === 'total_lamports') sorted.sort((a, b) => b.totalLamports - a.totalLamports);
    if (sort === 'member_count') sorted.sort((a, b) => b.memberCount - a.memberCount);
    if (sort === 'created_at')
      sorted.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
    return sorted;
  }, [commitments, fixtureId, status, sort]);

  const upcomingFixtures = useMemo(
    () => fixtures.filter((f) => f.kickoffTs > Date.now()).slice(0, 6),
    [fixtures],
  );

  return (
    <div>
      <section className="mb-8">
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
          Back your call. <span className="text-pitch-400">On-chain.</span>
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted sm:text-base">
          Fans lock conditional pledges on World Cup matches — solo or as a Fan
          DAO. Condition met at full time? The beneficiary is paid trustlessly
          by TxLINE&apos;s match proof. Not met? Everyone reclaims their stake.
        </p>
      </section>

      <DelayedDataBanner visible={indexerDown} />

      {upcomingFixtures.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-xs font-black uppercase tracking-wider text-muted">
            Upcoming fixtures — create a pledge
          </h2>
          <div className="flex flex-wrap gap-2">
            {upcomingFixtures.map((f) => (
              <Link
                key={f.fixtureId}
                href={`/fixture/${f.fixtureId}`}
                className="rounded-xl border border-edge bg-surface px-3.5 py-2 text-sm font-semibold transition-colors hover:border-pitch-700 hover:text-pitch-400"
              >
                {f.homeTeam} vs {f.awayTeam}
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <FixtureFilter
              fixtures={fixtures}
              fixtureId={fixtureId}
              status={status}
              onFixtureChange={setFixtureId}
              onStatusChange={setStatus}
            />
            <BoardSort sort={sort} onChange={setSort} />
          </div>

          {loading ? (
            <LoadingGrid />
          ) : visible.length === 0 ? (
            <EmptyState
              title={indexerDown ? 'Board unavailable' : 'No commitments yet'}
              body={
                indexerDown
                  ? 'The indexer is unreachable, so the board cannot load. Commitments on-chain are unaffected — try again shortly.'
                  : 'Be the first to lock a pledge. Pick an upcoming fixture, choose a condition, and put SOL behind your call.'
              }
              action={
                upcomingFixtures[0] ? (
                  <Link href={`/fixture/${upcomingFixtures[0].fixtureId}`} className="btn-primary">
                    Create the first pledge
                  </Link>
                ) : undefined
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
              {visible.map((c) => (
                <CommitmentCard key={c.pubkey} commitment={c} fixture={fixtureById.get(c.fixtureId)} />
              ))}
            </div>
          )}
        </div>

        <LiveFeed />
      </div>
    </div>
  );
}
