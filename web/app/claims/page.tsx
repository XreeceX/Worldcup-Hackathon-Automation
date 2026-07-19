'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { DelayedDataBanner } from '@/components/Banner';
import { EmptyState } from '@/components/EmptyState';
import { StatusBadge } from '@/components/StatusBadge';
import { toastTxError, toastTxSuccess } from '@/components/toast';
import { useClaims } from '@/hooks/useClaims';
import { useEscrow } from '@/hooks/useEscrow';
import { formatSol, truncateAddress } from '@/lib/format';
import type { ClaimRow } from '@/lib/types';

const ConnectMenu = dynamic(
  () => import('@/components/ConnectMenu').then((m) => m.ConnectMenu),
  { ssr: false },
);

function ClaimItem({
  claim,
  onClaimed,
}: {
  claim: ClaimRow;
  onClaimed: () => void;
}) {
  const escrow = useEscrow();
  const [busy, setBusy] = useState(false);
  const [claimed, setClaimed] = useState(false);

  const fixtureLine =
    claim.homeTeam && claim.awayTeam
      ? `${claim.homeTeam} vs ${claim.awayTeam}`
      : claim.fixtureId != null
        ? `Fixture #${claim.fixtureId}`
        : null;

  async function claimRefund() {
    if (!escrow || !claim.commitmentPubkey) return;
    setBusy(true);
    try {
      const sig = await escrow.claimRefund(claim.commitmentPubkey);
      toastTxSuccess(`Claimed ${formatSol(claim.depositLamports)} SOL.`, sig);
      setClaimed(true);
      onClaimed();
    } catch (err) {
      toastTxError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="card flex flex-wrap items-center justify-between gap-4 p-5">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/commitment/${claim.commitmentPubkey}`}
            className="truncate text-base font-bold hover:text-pitch-400"
          >
            {claim.name || truncateAddress(claim.commitmentPubkey, 6)}
          </Link>
          {claim.status && <StatusBadge status={claim.status} />}
        </div>
        <p className="mt-1 text-xs text-muted">
          {fixtureLine ? `${fixtureLine} · ` : ''}
          {claim.conditionLabel ?? 'Condition not met'} — refund available, no
          deadline.
        </p>
      </div>
      <div className="flex items-center gap-4">
        <span className="font-mono text-lg font-black tabular-nums">
          {formatSol(claim.depositLamports)} <span className="text-xs text-muted">SOL</span>
        </span>
        <button className="btn-primary" disabled={busy || claimed} onClick={claimRefund}>
          {claimed ? 'Claimed ✓' : busy ? 'Confirming…' : 'Claim'}
        </button>
      </div>
    </li>
  );
}

export default function ClaimsPage() {
  const { claims, loading, error, refresh, wallet } = useClaims();
  const total = claims.reduce((sum, c) => sum + c.depositLamports, 0);

  if (!wallet) {
    return (
      <EmptyState
        icon="👛"
        title="Connect your wallet"
        body="Pending refunds are tied to your wallet address. Connect to see everything you can claim."
        action={<ConnectMenu />}
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <section className="mb-6 fade-up">
        <h1 className="font-display text-4xl font-extrabold uppercase tracking-wide sm:text-5xl">
          Pending claims
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted sm:text-base">
          Refunds from commitments that resolved <em>not met</em> or were
          voided. Claims never expire.
        </p>
        {claims.length > 0 && (
          <p className="mt-4 inline-flex items-baseline gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-5 py-3">
            <span className="font-mono text-2xl font-black tabular-nums text-amber-400">
              {formatSol(total)} SOL
            </span>
            <span className="text-sm font-semibold text-amber-400/80">
              claimable across {claims.length} commitment{claims.length > 1 ? 's' : ''}
            </span>
          </p>
        )}
      </section>

      <DelayedDataBanner visible={error} />

      {loading ? (
        <div className="flex flex-col gap-3">
          <div className="card h-20 animate-pulse bg-raised/50" />
          <div className="card h-20 animate-pulse bg-raised/50" />
        </div>
      ) : claims.length === 0 ? (
        <EmptyState
          icon="✅"
          title="Nothing to claim"
          body="You have no pending refunds. If a commitment you joined resolves 'not met' or is voided, your claim appears here."
          action={
            <Link href="/" className="btn-secondary">
              Browse the board
            </Link>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {claims.map((c) => (
            <ClaimItem key={c.commitmentPubkey} claim={c} onClaimed={refresh} />
          ))}
        </ul>
      )}
    </div>
  );
}
