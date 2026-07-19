'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { DelayedDataBanner } from '@/components/Banner';
import { CommitmentCard } from '@/components/CommitmentCard';
import { EmptyState } from '@/components/EmptyState';
import { fetchBoard } from '@/lib/api';
import { formatSol } from '@/lib/format';
import type { BoardCommitment } from '@/lib/types';

const ConnectMenu = dynamic(
  () => import('@/components/ConnectMenu').then((m) => m.ConnectMenu),
  { ssr: false },
);

/** My active deposit in a commitment (withdrawn members hold no stake). */
function myStake(c: BoardCommitment, wallet: string): number {
  const entry = c.members?.find((m) => m.wallet === wallet);
  return entry && !entry.withdrawn ? entry.depositLamports : 0;
}

function StatTile({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="card px-5 py-4">
      <p className={`font-mono text-2xl font-black tabular-nums ${tone ?? ''}`}>{value}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
    </div>
  );
}

export default function MyPledgesPage() {
  const { publicKey } = useWallet();
  const wallet = publicKey?.toBase58();

  const [rows, setRows] = useState<BoardCommitment[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!wallet) return;
    let cancelled = false;
    setRows(null);
    setError(false);
    fetchBoard({ limit: 200 })
      .then((all) => {
        if (cancelled) return;
        setRows(
          all.filter(
            (c) =>
              c.founder === wallet ||
              c.members?.some((m) => m.wallet === wallet && !m.withdrawn),
          ),
        );
      })
      .catch(() => {
        if (!cancelled) {
          setRows([]);
          setError(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [wallet]);

  const stats = useMemo(() => {
    if (!wallet || !rows) return null;
    return rows.reduce(
      (acc, c) => {
        const stake = myStake(c, wallet);
        acc.staked += stake;
        if (c.status === 'Open') acc.active += 1;
        if (c.status === 'Executed') acc.paidOut += stake;
        if (c.status === 'Refunded' || c.status === 'Void') acc.refundable += stake;
        return acc;
      },
      { staked: 0, active: 0, paidOut: 0, refundable: 0 },
    );
  }, [rows, wallet]);

  if (!wallet) {
    return (
      <EmptyState
        icon="👛"
        title="Connect your wallet"
        body="Your pledges are read straight from the chain by your wallet address. Connect to see everything you've pledged."
        action={<ConnectMenu />}
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <section className="mb-6 fade-up">
        <h1 className="font-display text-4xl font-extrabold uppercase tracking-wide sm:text-5xl">
          My pledges
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted sm:text-base">
          Every commitment this wallet founded or joined — with your stake,
          what settled to beneficiaries, and what came back.
        </p>
      </section>

      <DelayedDataBanner visible={error} />

      {rows == null ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="card h-44 animate-pulse bg-raised/50" />
          <div className="card h-44 animate-pulse bg-raised/50" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon="🎯"
          title="No pledges yet"
          body="This wallet hasn't founded or joined a commitment. Pick a match on the board and put it on the line."
          action={
            <Link href="/" className="btn-secondary">
              Browse the board
            </Link>
          }
        />
      ) : (
        <>
          {stats && (
            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile label="Pledges" value={String(rows.length)} />
              <StatTile label="Your SOL at stake" value={formatSol(stats.staked)} />
              <StatTile
                label="Paid to beneficiaries"
                value={formatSol(stats.paidOut)}
                tone="text-pitch-400"
              />
              <StatTile
                label="In refunds"
                value={formatSol(stats.refundable)}
                tone="text-amber-400"
              />
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {rows.map((c) => {
              const stake = myStake(c, wallet);
              return (
                <div key={c.pubkey} className="flex flex-col gap-1.5">
                  <p className="flex items-center gap-2 px-1 text-[11px] font-bold uppercase tracking-wider text-muted">
                    {c.founder === wallet ? 'Founder' : 'Member'}
                    {stake > 0 && (
                      <span className="font-mono normal-case tracking-normal">
                        · your stake {formatSol(stake)} SOL
                      </span>
                    )}
                  </p>
                  <CommitmentCard commitment={c} />
                </div>
              );
            })}
          </div>

          {stats && stats.refundable > 0 && (
            <p className="mt-6 text-sm text-muted">
              You have{' '}
              <span className="font-bold text-amber-400">
                {formatSol(stats.refundable)} SOL
              </span>{' '}
              waiting in refunds —{' '}
              <Link href="/claims" className="font-bold text-pitch-400 hover:underline">
                claim it here
              </Link>
              .
            </p>
          )}
        </>
      )}
    </div>
  );
}
