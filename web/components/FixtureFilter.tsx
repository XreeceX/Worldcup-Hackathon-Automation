'use client';

import { useMemo } from 'react';
import { worldCupFixtures } from '@/lib/fixtures';
import type { Fixture } from '@/lib/types';
import type { SortKey } from '@/components/BoardSort';

/** Board ledger filters — Active = still open, Settled = done. */
export type BoardStatusFilter = 'Active' | 'Settled' | 'All';

const STATUS_TABS: { id: BoardStatusFilter; label: string }[] = [
  { id: 'Active', label: 'Active' },
  { id: 'Settled', label: 'Settled' },
  { id: 'All', label: 'All' },
];

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'total_lamports', label: 'Most SOL' },
  { key: 'member_count', label: 'Most members' },
  { key: 'created_at', label: 'Newest' },
];

export function BoardToolbar({
  fixtures,
  fixtureId,
  status,
  sort,
  onFixtureChange,
  onStatusChange,
  onSortChange,
  resultCount,
}: {
  fixtures: Fixture[];
  fixtureId: number | null;
  status: BoardStatusFilter;
  sort: SortKey;
  onFixtureChange: (id: number | null) => void;
  onStatusChange: (status: BoardStatusFilter) => void;
  onSortChange: (sort: SortKey) => void;
  resultCount: number;
}) {
  const wc = useMemo(() => worldCupFixtures(fixtures), [fixtures]);
  const selected = wc.find((f) => f.fixtureId === fixtureId);

  return (
    <div className="panel space-y-3 !bg-raised/40">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-xl border border-edge bg-surface p-1">
          {STATUS_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onStatusChange(t.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                status === t.id
                  ? 'bg-pitch-500 text-pitch-950'
                  : 'text-muted hover:text-ink'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <select
          aria-label="Sort pledges"
          className="input w-auto min-w-[8rem]"
          value={sort}
          onChange={(e) => onSortChange(e.target.value as SortKey)}
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>

        <select
          aria-label="Filter by match"
          className="input min-w-0 flex-1 sm:max-w-xs"
          value={fixtureId ?? ''}
          onChange={(e) =>
            onFixtureChange(e.target.value ? Number(e.target.value) : null)
          }
        >
          <option value="">All matches</option>
          {wc.map((f) => (
            <option key={f.fixtureId} value={f.fixtureId}>
              {f.homeTeam} vs {f.awayTeam}
            </option>
          ))}
        </select>
      </div>

      <p className="text-[11px] text-muted">
        <span className="font-semibold text-ink/80">{resultCount}</span>
        {resultCount === 1 ? ' pledge' : ' pledges'}
        {status === 'Active' ? ' still open' : status === 'Settled' ? ' settled' : ''}
        {selected ? (
          <>
            {' '}
            on{' '}
            <span className="font-semibold text-ink/80">
              {selected.homeTeam} vs {selected.awayTeam}
            </span>
            {' · '}
            <button
              type="button"
              className="font-semibold text-pitch-400 hover:underline"
              onClick={() => onFixtureChange(null)}
            >
              Clear match
            </button>
          </>
        ) : null}
      </p>
    </div>
  );
}

/** @deprecated use BoardToolbar — kept so old imports don't break mid-edit */
export function FixtureFilter(props: {
  fixtures: Fixture[];
  fixtureId: number | null;
  status: string;
  onFixtureChange: (id: number | null) => void;
  onStatusChange: (status: string) => void;
}) {
  return (
    <BoardToolbar
      fixtures={props.fixtures}
      fixtureId={props.fixtureId}
      status={
        props.status === 'Open'
          ? 'Active'
          : props.status === 'All'
            ? 'All'
            : 'Settled'
      }
      sort="total_lamports"
      onFixtureChange={props.onFixtureChange}
      onStatusChange={(s) =>
        props.onStatusChange(s === 'Active' ? 'Open' : s === 'All' ? 'All' : 'Executed')
      }
      onSortChange={() => {}}
      resultCount={0}
    />
  );
}
