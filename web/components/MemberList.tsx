'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { explorerAddressUrl } from '@/lib/config';
import { formatSol, truncateAddress } from '@/lib/format';
import type { CommitmentMember } from '@/lib/types';

export function MemberList({
  members,
  founder,
}: {
  members: CommitmentMember[];
  founder: string;
}) {
  const { publicKey } = useWallet();
  const me = publicKey?.toBase58();
  // Founder first, then by deposit size.
  const sorted = [...members].sort((a, b) => {
    if (a.wallet === founder) return -1;
    if (b.wallet === founder) return 1;
    return b.depositLamports - a.depositLamports;
  });

  return (
    <section className="card p-5">
      <h2 className="mb-3 text-xs font-black uppercase tracking-wider">
        Members ({members.filter((m) => !m.withdrawn).length})
      </h2>
      <ul className="divide-y divide-edge">
        {sorted.map((m) => (
          <li key={m.wallet} className="flex items-center justify-between gap-3 py-2.5 text-sm">
            <span className="flex items-center gap-2 font-mono text-xs">
              <a
                href={explorerAddressUrl(m.wallet)}
                target="_blank"
                rel="noreferrer"
                className={`hover:underline ${m.withdrawn ? 'text-muted line-through' : ''}`}
              >
                {truncateAddress(m.wallet, 6)}
              </a>
              {m.wallet === founder && (
                <span className="rounded-full bg-pitch-500/15 px-2 py-0.5 text-[10px] font-bold text-pitch-400">
                  FOUNDER
                </span>
              )}
              {m.wallet === me && (
                <span className="rounded-full bg-raised px-2 py-0.5 text-[10px] font-bold text-muted">
                  YOU
                </span>
              )}
            </span>
            <span className="flex items-center gap-2">
              {m.withdrawn && <span className="text-[10px] font-bold text-muted">WITHDREW</span>}
              {m.claimed && <span className="text-[10px] font-bold text-amber-400">CLAIMED</span>}
              <span className={`font-mono text-xs font-bold tabular-nums ${m.withdrawn ? 'text-muted' : ''}`}>
                {formatSol(m.depositLamports)} SOL
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
