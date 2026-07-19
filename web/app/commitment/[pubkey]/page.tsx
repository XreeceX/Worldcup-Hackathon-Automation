'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useConnection } from '@solana/wallet-adapter-react';
import { DelayedDataBanner } from '@/components/Banner';
import {
  ClaimRefundButton,
  JoinButton,
  ResolveButton,
  VoidButton,
  WithdrawButton,
} from '@/components/CommitmentActions';
import { EmptyState } from '@/components/EmptyState';
import { InPlayCard } from '@/components/InPlayCard';
import { MemberList } from '@/components/MemberList';
import { StatusBadge } from '@/components/StatusBadge';
import { useFeed } from '@/hooks/useFeed';
import { fetchCommitment, fetchFixtures } from '@/lib/api';
import { conditionLabel } from '@/lib/conditions';
import { explorerTxUrl } from '@/lib/config';
import { fetchOnChainCommitment, type OnChainCommitment } from '@/lib/escrow';
import { formatKickoff } from '@/lib/format';
import type { BoardCommitment, Fixture } from '@/lib/types';

export default function CommitmentPage() {
  const params = useParams<{ pubkey: string }>();
  const pubkey = params.pubkey;
  const { connection } = useConnection();

  const [onChain, setOnChain] = useState<OnChainCommitment | null>(null);
  const [indexed, setIndexed] = useState<BoardCommitment | null>(null);
  const [fixture, setFixture] = useState<Fixture | null>(null);
  const [loading, setLoading] = useState(true);
  const [chainError, setChainError] = useState(false);
  const [indexerDown, setIndexerDown] = useState(false);
  const { resolvedPubkeys } = useFeed();

  const refresh = useCallback(async () => {
    const [chainRes, indexedRes] = await Promise.allSettled([
      fetchOnChainCommitment(connection, pubkey),
      fetchCommitment(pubkey),
    ]);
    if (chainRes.status === 'fulfilled') {
      setOnChain(chainRes.value);
      setChainError(false);
    } else {
      setChainError(true);
    }
    if (indexedRes.status === 'fulfilled') {
      setIndexed(indexedRes.value);
      setIndexerDown(false);
    } else {
      setIndexerDown(true);
    }
  }, [connection, pubkey]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    refresh().finally(() => {
      if (!cancelled) setLoading(false);
    });
    const timer = setInterval(refresh, 30_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [refresh]);

  // A `resolved` feed event for this commitment → re-read on-chain state.
  const feedResolved = resolvedPubkeys.has(pubkey);
  useEffect(() => {
    if (feedResolved) refresh();
  }, [feedResolved, refresh]);

  useEffect(() => {
    if (!onChain) return;
    let cancelled = false;
    fetchFixtures()
      .then((fx) => {
        if (!cancelled) {
          setFixture(fx.find((f) => f.fixtureId === onChain.fixtureId) ?? null);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [onChain?.fixtureId]); // eslint-disable-line react-hooks/exhaustive-deps

  const home = fixture?.homeTeam ?? indexed?.homeTeam;
  const away = fixture?.awayTeam ?? indexed?.awayTeam;

  const label = useMemo(
    () =>
      onChain
        ? conditionLabel(onChain.conditionTemplate, onChain.conditionParam, home, away)
        : '',
    [onChain, home, away],
  );

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="card h-28 animate-pulse bg-raised/50" />
        <div className="card h-64 animate-pulse bg-raised/50" />
      </div>
    );
  }

  if (!onChain) {
    return (
      <EmptyState
        title={chainError ? 'Could not reach Solana' : 'Commitment not found'}
        body={
          chainError
            ? 'The devnet RPC is unreachable. Refresh to try again.'
            : 'No commitment account exists at this address on devnet.'
        }
        action={
          <Link href="/" className="btn-secondary">
            Back to board
          </Link>
        }
      />
    );
  }

  const nowSec = Date.now() / 1000;
  const matchStarted = nowSec >= onChain.kickoffTs;
  const resolvedOnChain = onChain.status !== 'Open' || feedResolved;
  const settlementTx = indexed?.settlementTx ?? null;

  return (
    <div>
      <Link href="/" className="mb-4 inline-block text-sm font-semibold text-muted hover:text-ink">
        ← Back to board
      </Link>

      <DelayedDataBanner visible={indexerDown} />

      {/* CommitmentHeader */}
      <section className="card mb-6 p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
              {onChain.name || label}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {home && away ? (
                <Link href={`/fixture/${onChain.fixtureId}`} className="font-semibold text-ink/90 hover:text-pitch-400">
                  {home} vs {away}
                </Link>
              ) : (
                <Link href={`/fixture/${onChain.fixtureId}`} className="font-semibold text-ink/90 hover:text-pitch-400">
                  Fixture #{onChain.fixtureId}
                </Link>
              )}
              {' · '}kickoff {formatKickoff(onChain.kickoffTs * 1000)}
            </p>
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-raised px-3 py-1.5 text-sm font-bold text-pitch-400">
              🎯 {label}
            </p>
          </div>
          <StatusBadge status={onChain.status} />
        </div>
        {onChain.status === 'Executed' && settlementTx && (
          <a
            href={explorerTxUrl(settlementTx)}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-gold-500/40 bg-gold-500/10 px-3.5 py-2 text-sm font-bold text-gold-300 hover:bg-gold-500/20"
          >
            🏆 Settled — view transaction on explorer ↗
          </a>
        )}
      </section>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)]">
        <div className="flex flex-col gap-6">
          {matchStarted && (
            <InPlayCard
              fixtureId={onChain.fixtureId}
              template={onChain.conditionTemplate}
              param={onChain.conditionParam}
              homeTeam={home}
              awayTeam={away}
              status={onChain.status}
              resolvedOnChain={resolvedOnChain}
              competition={fixture?.competition}
              kickoffTs={fixture?.kickoffTs ?? onChain.kickoffTs * 1000}
            />
          )}

          <MemberList members={onChain.members} founder={onChain.founder} />
        </div>

        <div className="flex flex-col gap-6">
          {/* Actions */}
          <section className="card flex flex-col gap-4 p-5">
            <h2 className="text-xs font-black uppercase tracking-wider">Actions</h2>
            <JoinButton commitment={onChain} onChanged={refresh} />
            <WithdrawButton commitment={onChain} onChanged={refresh} />
            <ResolveButton commitment={onChain} onChanged={refresh} />
            <VoidButton commitment={onChain} onChanged={refresh} />
            <ClaimRefundButton commitment={onChain} onChanged={refresh} />
            {onChain.status === 'Open' && (
              <p className="text-xs text-muted">
                {matchStarted
                  ? 'You can still join while the match is live. Withdrawals lock at kickoff. After full time, the keeper resolves with TxLINE’s on-chain match proof.'
                  : 'Join anytime before or during the match. Withdrawals lock at kickoff. After full time, the keeper resolves with TxLINE’s on-chain match proof.'}
              </p>
            )}
            {(onChain.status === 'Executed' || onChain.status === 'Closed') && (
              <p className="text-xs text-muted">
                This commitment is settled — no further actions are possible.
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
