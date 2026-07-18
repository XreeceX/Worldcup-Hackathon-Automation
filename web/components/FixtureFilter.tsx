'use client';

import type { Fixture } from '@/lib/types';

const STATUSES = ['All', 'Open', 'Executed', 'Refunded', 'Void', 'Closed'];

export function FixtureFilter({
  fixtures,
  fixtureId,
  status,
  onFixtureChange,
  onStatusChange,
}: {
  fixtures: Fixture[];
  fixtureId: number | null;
  status: string;
  onFixtureChange: (id: number | null) => void;
  onStatusChange: (status: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label="Filter by fixture"
        className="input w-auto"
        value={fixtureId ?? ''}
        onChange={(e) => onFixtureChange(e.target.value ? Number(e.target.value) : null)}
      >
        <option value="">All fixtures</option>
        {fixtures.map((f) => (
          <option key={f.fixtureId} value={f.fixtureId}>
            {f.homeTeam} vs {f.awayTeam}
          </option>
        ))}
      </select>
      <div className="flex gap-1 rounded-xl border border-edge bg-raised p-1">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => onStatusChange(s)}
            className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${
              status === s ? 'bg-pitch-500 text-pitch-950' : 'text-muted hover:text-ink'
            }`}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
