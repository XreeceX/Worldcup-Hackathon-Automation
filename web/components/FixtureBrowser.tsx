'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { CountryFlag } from '@/components/CountryFlag';
import { formatKickoff } from '@/lib/format';
import {
  bucketForFixture,
  filterFixturesByBucket,
  isPledgeResultsPending,
  isPledgeableFixture,
  worldCupFixtures,
  type FixtureBucket,
} from '@/lib/fixtures';
import {
  WC_STAGE_LABEL,
  WC_STAGE_ORDER,
  type WcStage,
} from '@/lib/wcSchedule';
import type { Fixture } from '@/lib/types';

type MainTab = 'live_pledges' | 'past';
type StageFilter = 'all' | WcStage;

function PillRow<T extends string>({
  items,
  active,
  onChange,
}: {
  items: { id: T; label: string; count?: number }[];
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-xl border border-edge bg-raised p-1">
      {items.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
            active === t.id
              ? 'bg-pitch-500 text-pitch-950'
              : 'text-muted hover:text-ink'
          }`}
        >
          {t.label}
          {t.count != null ? (
            <span className="ml-1.5 tabular-nums opacity-70">{t.count}</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

/**
 * Simple match browser:
 * - Live pledges = Open + Coming soon (you can still pledge / follow)
 * - Past = finished matches, filterable by WC stage
 */
export function FixtureBrowser({
  fixtures,
  onSelectFixture,
  compact = false,
}: {
  fixtures: Fixture[];
  onSelectFixture?: (fixtureId: number) => void;
  /** Single-column list for the board sidebar */
  compact?: boolean;
}) {
  const [main, setMain] = useState<MainTab>('live_pledges');
  const [stage, setStage] = useState<StageFilter>('all');

  const wc = useMemo(() => worldCupFixtures(fixtures), [fixtures]);
  const now = Date.now();

  const livePledges = useMemo(
    () =>
      wc
        .filter((f) => isPledgeableFixture(f, now))
        .sort((a, b) => {
          const aLive = bucketForFixture(a, now) === 'live' ? 0 : 1;
          const bLive = bucketForFixture(b, now) === 'live' ? 0 : 1;
          if (aLive !== bLive) return aLive - bLive;
          return a.kickoffTs - b.kickoffTs;
        }),
    [wc, now],
  );

  const past = useMemo(
    () => filterFixturesByBucket(wc, 'finished', now),
    [wc, now],
  );

  const stageCounts = useMemo(() => {
    const counts: Partial<Record<WcStage, number>> = {};
    for (const f of past) {
      if (!f.stage) continue;
      counts[f.stage] = (counts[f.stage] ?? 0) + 1;
    }
    return counts;
  }, [past]);

  const rows = useMemo(() => {
    if (main === 'live_pledges') return livePledges;
    if (stage === 'all') return past;
    return past.filter((f) => f.stage === stage);
  }, [main, livePledges, past, stage]);

  const grouped = useMemo(() => {
    if (main === 'live_pledges') {
      const open = rows.filter((f) => bucketForFixture(f, now) === 'live');
      const soon = rows.filter((f) => bucketForFixture(f, now) === 'upcoming');
      const groups: { key: string; title: string; items: Fixture[] }[] = [];
      if (open.length) groups.push({ key: 'open', title: 'In play', items: open });
      if (soon.length) groups.push({ key: 'soon', title: 'Coming soon', items: soon });
      return groups.length ? groups : [{ key: 'empty', title: '', items: [] }];
    }
    // Past: group by stage when viewing all
    if (stage !== 'all') {
      return [{ key: 'list', title: '', items: rows }];
    }
    const map = new Map<string, Fixture[]>();
    for (const f of rows) {
      const key = f.stageLabel ?? 'Other';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(f);
    }
    const ordered: { key: string; title: string; items: Fixture[] }[] = [];
    for (const s of WC_STAGE_ORDER) {
      const title = WC_STAGE_LABEL[s];
      const items = map.get(title);
      if (items?.length) ordered.push({ key: s, title, items });
      map.delete(title);
    }
    for (const [title, items] of Array.from(map.entries())) {
      ordered.push({ key: title, title, items });
    }
    return ordered;
  }, [main, stage, rows, now]);

  if (!wc.length) return null;

  const mainPills: { id: MainTab; label: string; count: number }[] = [
    { id: 'live_pledges', label: 'Live pledges', count: livePledges.length },
    { id: 'past', label: 'Past', count: past.length },
  ];

  const stagePills: { id: StageFilter; label: string; count?: number }[] = [
    { id: 'all', label: 'All', count: past.length },
    ...WC_STAGE_ORDER.filter((s) => (stageCounts[s] ?? 0) > 0).map((s) => ({
      id: s as StageFilter,
      label: WC_STAGE_LABEL[s],
      count: stageCounts[s],
    })),
  ];

  const gridClass = compact
    ? 'grid gap-2'
    : 'grid gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4';

  return (
    <section className={`space-y-3 ${compact ? 'panel' : 'mb-2'}`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-extrabold uppercase tracking-wide">
            Matches
          </h2>
          <p className="mt-0.5 text-[11px] text-muted">
            {main === 'live_pledges'
              ? 'Knockout fixtures you can pledge on or follow'
              : 'Finished knockout matches — ledger & stats only'}
          </p>
        </div>
        <PillRow
          items={mainPills}
          active={main}
          onChange={(id) => {
            setMain(id);
            setStage('all');
          }}
        />
      </div>

      {main === 'past' && stagePills.length > 1 && (
        <PillRow items={stagePills} active={stage} onChange={setStage} />
      )}

      {rows.length === 0 ? (
        <p className="rounded-xl border border-edge bg-raised/40 px-4 py-6 text-center text-sm text-muted">
          {main === 'live_pledges'
            ? 'No live or upcoming knockout matches right now. Check Past for finished games.'
            : 'No finished matches in this stage.'}
        </p>
      ) : (
        <div className="space-y-4">
          {grouped.map((group) =>
            group.items.length === 0 ? null : (
              <div key={group.key}>
                {group.title ? (
                  <h3 className="mb-2 text-[11px] font-black uppercase tracking-widest text-pitch-400/90">
                    {group.title}
                    <span className="ml-2 font-semibold text-muted">
                      ({group.items.length})
                    </span>
                  </h3>
                ) : null}
                <div className={gridClass}>
                  {group.items.map((f) => (
                    <FixtureChip
                      key={f.fixtureId}
                      fixture={f}
                      onSelect={onSelectFixture}
                    />
                  ))}
                </div>
              </div>
            ),
          )}
        </div>
      )}
    </section>
  );
}

function FixtureChip({
  fixture,
  onSelect,
}: {
  fixture: Fixture;
  onSelect?: (fixtureId: number) => void;
}) {
  const now = Date.now();
  const bucket: FixtureBucket = bucketForFixture(fixture, now);
  const pending = isPledgeResultsPending(fixture, undefined, now);
  const pledgeable = isPledgeableFixture(fixture, now);

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-edge bg-surface px-3.5 py-3 transition-colors hover:border-pitch-700/60">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5 text-sm font-bold">
            <CountryFlag team={fixture.homeTeam} size={16} />
            <span className="truncate">{fixture.homeTeam}</span>
            <span className="text-muted">vs</span>
            <CountryFlag team={fixture.awayTeam} size={16} />
            <span className="truncate">{fixture.awayTeam}</span>
          </p>
          <p className="mt-0.5 text-[11px] text-muted">
            {fixture.stageLabel ? `${fixture.stageLabel} · ` : ''}
            {formatKickoff(fixture.kickoffTs)}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-wider ${
            pending
              ? 'bg-amber-500/20 text-amber-300'
              : bucket === 'live'
                ? 'bg-pitch-500/20 text-pitch-400'
                : bucket === 'upcoming'
                  ? 'bg-sky-500/15 text-sky-300'
                  : 'bg-raised text-muted'
          }`}
        >
          {pending ? 'Pending' : bucket === 'live' ? 'Live' : bucket === 'upcoming' ? 'Soon' : 'FT'}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {pledgeable ? (
          <button
            type="button"
            onClick={() => {
              onSelect?.(fixture.fixtureId);
              document.getElementById('pledge-board')?.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
              });
            }}
            className="flex-1 rounded-lg bg-pitch-500 px-3 py-2 text-center text-xs font-bold text-ink hover:bg-pitch-400"
          >
            Pledge board
          </button>
        ) : pending ? (
          <button
            type="button"
            onClick={() => {
              onSelect?.(fixture.fixtureId);
              document.getElementById('pledge-board')?.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
              });
            }}
            className="flex-1 rounded-lg border border-amber-500/40 bg-amber-500/15 px-3 py-2 text-center text-xs font-bold text-amber-200"
          >
            Results pending
          </button>
        ) : (
          <span className="flex-1 rounded-lg border border-rose-500/40 bg-rose-500/15 px-3 py-2 text-center text-xs font-bold text-rose-300">
            Ended
          </span>
        )}
        <Link
          href={`/fixture/${fixture.fixtureId}`}
          className="rounded-lg border border-edge px-3 py-2 text-center text-xs font-bold text-muted hover:border-pitch-700 hover:text-pitch-400"
        >
          Match centre
        </Link>
      </div>
    </div>
  );
}
