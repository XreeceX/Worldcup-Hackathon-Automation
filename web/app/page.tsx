'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { DelayedDataBanner } from '@/components/Banner';
import type { SortKey } from '@/components/BoardSort';
import { CommitmentCard } from '@/components/CommitmentCard';
import { CreateCommitmentForm } from '@/components/CreateCommitmentForm';
import { EmptyState, LoadingGrid } from '@/components/EmptyState';
import { FixtureBrowser } from '@/components/FixtureBrowser';
import { BoardToolbar, type BoardStatusFilter } from '@/components/FixtureFilter';
import { BoardStats } from '@/components/BoardStats';
import { LiveFeed } from '@/components/LiveFeed';
import { useLiveScore } from '@/hooks/useLiveScore';
import { fetchBoard, fetchFixtures } from '@/lib/api';
import {
  canCreatePledge,
  isKnockoutWorldCupFixture,
  isMatchEnded,
  mergeFixturesMonotonic,
  worldCupFixtures,
} from '@/lib/fixtures';
import { isKnockoutStage, stageForFixtureId } from '@/lib/wcSchedule';
import type { BoardCommitment, Fixture } from '@/lib/types';

const REFRESH_MS = 20_000;

export default function BoardPage() {
  const [commitments, setCommitments] = useState<BoardCommitment[]>([]);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [indexerDown, setIndexerDown] = useState(false);

  const [fixtureId, setFixtureId] = useState<number | null>(null);
  const [status, setStatus] = useState<BoardStatusFilter>('Active');
  const [sort, setSort] = useState<SortKey>('total_lamports');

  const live = useLiveScore(fixtureId);

  const load = useCallback(async (isLatest: () => boolean) => {
    const [boardRes, fixturesRes] = await Promise.allSettled([
      fetchBoard({
        fixtureId: fixtureId ?? undefined,
        status: status === 'Active' ? 'Open' : undefined,
        sort,
      }),
      fetchFixtures(),
    ]);
    if (!isLatest()) return;
    if (boardRes.status === 'fulfilled') {
      setCommitments(boardRes.value);
      setIndexerDown(false);
    } else {
      setIndexerDown(true);
    }
    if (fixturesRes.status === 'fulfilled') {
      setFixtures((prev) => mergeFixturesMonotonic(prev, fixturesRes.value));
    }
  }, [fixtureId, status, sort]);

  useEffect(() => {
    let cancelled = false;
    let generation = 0;

    const run = () => {
      const gen = ++generation;
      return load(() => !cancelled && generation === gen);
    };

    setLoading(true);
    run().finally(() => {
      if (!cancelled) setLoading(false);
    });
    const timer = setInterval(() => {
      void run();
    }, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [load]);

  const fixtureById = useMemo(
    () => new Map(fixtures.map((f) => [f.fixtureId, f])),
    [fixtures],
  );

  const selectedFixture = useMemo(
    () => (fixtureId != null ? fixtureById.get(fixtureId) ?? null : null),
    [fixtureById, fixtureId],
  );

  const visible = useMemo(() => {
    let rows = commitments.filter((c) => {
      const f = fixtureById.get(c.fixtureId);
      if (f) return isKnockoutWorldCupFixture(f);
      return isKnockoutStage(stageForFixtureId(c.fixtureId));
    });
    if (fixtureId != null) rows = rows.filter((c) => c.fixtureId === fixtureId);
    if (status === 'Active') rows = rows.filter((c) => c.status === 'Open');
    if (status === 'Settled') rows = rows.filter((c) => c.status !== 'Open');
    const sorted = [...rows];
    if (sort === 'total_lamports') sorted.sort((a, b) => b.totalLamports - a.totalLamports);
    if (sort === 'member_count') sorted.sort((a, b) => b.memberCount - a.memberCount);
    if (sort === 'created_at')
      sorted.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
    return sorted;
  }, [commitments, fixtureById, fixtureId, status, sort]);

  const showCreateForm = useMemo(() => {
    if (!selectedFixture) return false;
    if (!isKnockoutWorldCupFixture(selectedFixture)) return false;
    if (
      isMatchEnded(selectedFixture, {
        finalised: live.score.finalised,
        statusId: live.score.statusId,
      })
    ) {
      return false;
    }
    return canCreatePledge(selectedFixture);
  }, [selectedFixture, live.score.finalised, live.score.statusId]);

  const firstCreatable = useMemo(() => {
    return (
      worldCupFixtures(fixtures)
        .filter((f) => canCreatePledge(f))
        .sort((a, b) => a.kickoffTs - b.kickoffTs)[0] ?? null
    );
  }, [fixtures]);

  function focusCreate(fixture?: Fixture | null) {
    const target = fixture ?? firstCreatable;
    if (!target) return;
    setFixtureId(target.fixtureId);
    setStatus('All');
    requestAnimationFrame(() => {
      document.getElementById('create-pledge')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  }

  return (
    <div className="flex min-h-[calc(100dvh-8.5rem)] flex-col">
      <section className="fade-up relative mb-6 overflow-hidden rounded-2xl border border-edge/70 bg-surface/40 px-5 py-6 sm:px-8 sm:py-8">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(34,197,94,0.18),transparent_55%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-8 top-0 h-full w-1/2 opacity-30"
          style={{
            backgroundImage:
              'repeating-linear-gradient(-12deg, transparent, transparent 14px, rgba(34,197,94,0.12) 14px, rgba(34,197,94,0.12) 15px)',
          }}
        />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="font-display text-sm font-bold uppercase tracking-[0.2em] text-pitch-400">
              PledgePitch
            </p>
            <h1 className="mt-1 font-display text-4xl font-extrabold uppercase leading-[0.95] tracking-wide sm:text-5xl lg:text-6xl">
              Back your call.
              <span className="block text-pitch-400">On-chain.</span>
            </h1>
            <p className="mt-3 max-w-xl text-sm text-muted sm:text-base">
              Lock a knockout World Cup pledge. At full time, TxLINE settles it —
              paid out if your call lands, refunded if not.
            </p>
          </div>
          <div className="flex flex-col items-stretch gap-4 sm:items-end">
            <BoardStats rows={commitments} />
            {firstCreatable ? (
              <button
                type="button"
                onClick={() => focusCreate(firstCreatable)}
                className="btn-primary shrink-0 px-6 py-3 text-sm font-bold"
              >
                Create a pledge
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <DelayedDataBanner visible={indexerDown} />

      <div className="grid flex-1 gap-6 xl:grid-cols-[minmax(18rem,26rem)_minmax(0,1fr)] xl:gap-8 2xl:grid-cols-[minmax(20rem,28rem)_minmax(0,1fr)]">
        <aside className="fade-up min-w-0 xl:sticky xl:top-[4.5rem] xl:max-h-[calc(100dvh-5.5rem)] xl:overflow-y-auto xl:self-start xl:[animation-delay:60ms]">
          <FixtureBrowser
            fixtures={fixtures}
            compact
            onSelectFixture={(id) => {
              setFixtureId(id);
              setStatus('All');
            }}
          />
        </aside>

        <section id="pledge-board" className="fade-up scroll-mt-20 min-w-0 xl:[animation-delay:120ms]">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-extrabold uppercase tracking-wide">
                Pledge board
              </h2>
              <p className="mt-0.5 text-sm text-muted">
                Existing pledges for the selected match — create one if the board is empty.
              </p>
            </div>
          </div>

          <div className="mb-5">
            <BoardToolbar
              fixtures={fixtures}
              fixtureId={fixtureId}
              status={status}
              sort={sort}
              onFixtureChange={setFixtureId}
              onStatusChange={setStatus}
              onSortChange={setSort}
              resultCount={visible.length}
            />
          </div>

          {loading ? (
            <LoadingGrid />
          ) : visible.length === 0 ? (
            <EmptyState
              title={indexerDown ? 'Board unavailable' : 'No pledges yet'}
              body={
                indexerDown
                  ? 'The indexer is unreachable. Try again shortly.'
                  : selectedFixture
                    ? showCreateForm
                      ? `Nobody has pledged on ${selectedFixture.homeTeam} vs ${selectedFixture.awayTeam} yet. Create the first one below.`
                      : 'No pledges on this match.'
                    : status === 'Active'
                      ? 'No open pledges. Pick a Coming soon match, then create one.'
                      : 'No pledges match these filters.'
              }
              action={
                !selectedFixture && firstCreatable ? (
                  <button
                    type="button"
                    onClick={() => focusCreate(firstCreatable)}
                    className="btn-primary"
                  >
                    Pick a match & create
                  </button>
                ) : undefined
              }
            />
          ) : (
            <div className="grid auto-rows-fr gap-3 sm:grid-cols-2 2xl:grid-cols-3">
              {visible.map((c) => (
                <CommitmentCard
                  key={c.pubkey}
                  commitment={c}
                  fixture={fixtureById.get(c.fixtureId)}
                />
              ))}
            </div>
          )}

          {showCreateForm && selectedFixture && (
            <div id="create-pledge" className="mt-6 scroll-mt-24 w-full max-w-xl">
              <CreateCommitmentForm
                fixture={selectedFixture}
                matchFinalised={live.score.finalised}
                statusId={live.score.statusId}
              />
            </div>
          )}

          {!showCreateForm && selectedFixture && visible.length > 0 && (
            <p className="mt-4 text-sm text-muted">
              Creating is closed for this match.{' '}
              <Link
                href={`/fixture/${selectedFixture.fixtureId}`}
                className="font-semibold text-pitch-400 hover:underline"
              >
                Open match centre →
              </Link>
            </p>
          )}

          <LiveFeed />
        </section>
      </div>
    </div>
  );
}
