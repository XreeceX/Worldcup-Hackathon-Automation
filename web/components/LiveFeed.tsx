'use client';

import Link from 'next/link';
import { useFeed } from '@/hooks/useFeed';
import { explorerTxUrl } from '@/lib/config';
import { formatSol, truncateAddress } from '@/lib/format';

/** Compact SSE settlement strip — sits under the board, not a tall empty sidebar. */
export function LiveFeed() {
  const { events, state } = useFeed();
  const recent = events.slice(0, 6);

  return (
    <section className="panel mt-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-base font-extrabold uppercase tracking-wide">
          Live settlements
        </h2>
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
          {state === 'open' ? 'Connected' : 'Reconnecting…'}
        </span>
      </div>

      {recent.length === 0 ? (
        <p className="text-sm text-muted">
          Settlements appear here when pledges resolve after full time.
        </p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {recent.map((ev, i) => {
            const c = ev.commitment;
            const met = ev.conditionMet;
            return (
              <li
                key={`${ev.receivedAt}-${i}`}
                className="rounded-xl border border-edge bg-raised/50 px-3 py-2.5 text-xs"
              >
                <p className="font-bold">
                  {met === true && (
                    <span className="text-pitch-400">
                      Paid{' '}
                      {c?.totalLamports != null
                        ? `${formatSol(c.totalLamports)} SOL`
                        : ''}
                    </span>
                  )}
                  {met === false && (
                    <span className="text-rose-300">Not met · refunds open</span>
                  )}
                  {met == null && <span className="text-muted">{ev.type}</span>}
                </p>
                <p className="mt-0.5 truncate text-muted">
                  {c?.name || c?.conditionLabel || 'Commitment'}
                  {c?.beneficiary ? ` · ${truncateAddress(c.beneficiary, 4)}` : ''}
                </p>
                <div className="mt-1.5 flex gap-3">
                  {c?.pubkey && (
                    <Link
                      href={`/commitment/${c.pubkey}`}
                      className="font-semibold text-pitch-400 hover:underline"
                    >
                      View
                    </Link>
                  )}
                  {ev.txSig && (
                    <a
                      href={explorerTxUrl(ev.txSig)}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-muted hover:text-ink"
                    >
                      Explorer
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
