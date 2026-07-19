'use client';

import { useMemo } from 'react';
import { useFeed } from '@/hooks/useFeed';
import { truncateAddress } from '@/lib/format';

function lineFor(e: {
  type: string;
  conditionMet?: boolean;
  commitment?: { name?: string; pubkey?: string; beneficiary?: string };
  fixtureId?: number;
}): string {
  const name = e.commitment?.name || 'pledge';
  const bene = e.commitment?.beneficiary
    ? truncateAddress(e.commitment.beneficiary, 3)
    : '';
  const match =
    e.fixtureId != null ? ` · fixture #${e.fixtureId}` : '';
  if (e.type === 'resolved' && e.conditionMet) {
    return `RELEASED · ${name}${bene ? ` → ${bene}` : ''}${match}`;
  }
  if (e.type === 'resolved') {
    return `NOT MET · ${name} refundable${match}`;
  }
  if (e.type === 'voided') {
    return `VOIDED · ${name}${match}`;
  }
  return `${e.type.toUpperCase()} · ${name}${match}`;
}

/** Site-wide marquee of recent settlement feed events. */
export function LiveTicker() {
  const { events } = useFeed();
  const items = useMemo(
    () => events.slice(0, 12).map(lineFor).filter(Boolean),
    [events],
  );
  if (items.length === 0) return null;
  const row = [...items, ...items];

  return (
    <div className="overflow-hidden border-b border-edge/80 bg-surface/80">
      <div className="marquee flex w-max gap-8 whitespace-nowrap px-4 py-1.5 text-xs text-muted">
        {row.map((it, i) => (
          <span key={`${it}-${i}`} className="inline-flex items-center gap-2">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-pitch-500 shadow-[0_0_6px_rgba(34,197,94,0.8)]" />
            {it}
          </span>
        ))}
      </div>
    </div>
  );
}
