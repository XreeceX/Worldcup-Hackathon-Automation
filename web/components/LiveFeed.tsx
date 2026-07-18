'use client';

import Link from 'next/link';
import { useFeed } from '@/hooks/useFeed';
import { explorerTxUrl } from '@/lib/config';
import { formatSol, truncateAddress } from '@/lib/format';

/** SSE-backed live settlement feed panel (FR-10, keeper /api/feed). */
export function LiveFeed() {
  const { events, state } = useFeed();

  return (
    <aside className="card flex h-fit flex-col p-5 lg:sticky lg:top-24">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-black uppercase tracking-wider">Live settlements</h2>
        <span
          className={`inline-flex items-center gap-1.5 text-[11px] font-bold ${
            state === 'open' ? 'text-pitch-400' : 'text-amber-400'
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              state === 'open' ? 'bg-pitch-400' : 'animate-pulse bg-amber-400'
            }`}
          />
          {state === 'open' ? 'LIVE' : 'Reconnecting…'}
        </span>
      </div>

      {events.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">
          No settlements yet. Resolutions land here in real time when matches
          finalise.
        </p>
      ) : (
        <ul className="flex max-h-[28rem] flex-col gap-2 overflow-y-auto">
          {events.map((ev, i) => {
            const c = ev.commitment;
            const isGroup = (c?.memberCount ?? 1) > 1;
            const met = ev.conditionMet;
            return (
              <li
                key={`${ev.receivedAt}-${i}`}
                className="rounded-xl border border-edge bg-raised/60 p-3 text-xs"
              >
                <p className="font-bold">
                  {met === true && (
                    <span className="text-pitch-400">
                      {c?.totalLamports != null ? `${formatSol(c.totalLamports)} SOL → ` : 'Paid → '}
                      {c?.beneficiary ? truncateAddress(c.beneficiary) : 'beneficiary'} ✓
                    </span>
                  )}
                  {met === false && (
                    <span className="text-amber-400">Pledge not met ✗ — refunds open</span>
                  )}
                  {met == null && <span className="text-muted">{ev.type}</span>}
                </p>
                <p className="mt-1 text-muted">
                  {c?.name ? `${c.name} · ` : ''}
                  {c?.conditionLabel ?? ''}
                  {isGroup && c?.memberCount ? ` · ${c.memberCount} members` : ''}
                </p>
                <div className="mt-1.5 flex gap-3">
                  {c?.pubkey && (
                    <Link href={`/commitment/${c.pubkey}`} className="font-semibold text-pitch-400 hover:underline">
                      View
                    </Link>
                  )}
                  {ev.txSig && (
                    <a
                      href={explorerTxUrl(ev.txSig)}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-muted hover:text-ink hover:underline"
                    >
                      Explorer ↗
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
