'use client';

import { useEffect, useState } from 'react';
import { explorerAddressUrl, explorerTxUrl } from '@/lib/config';
import { formatSol, truncateAddress } from '@/lib/format';
import type { CommitmentStatus } from '@/lib/types';

function CountUp({ lamports }: { lamports: number }) {
  const [v, setV] = useState(0);
  const target = lamports / 1e9;
  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 1200);
      setV(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return (
    <div className="mt-3 font-mono text-5xl font-black tabular-nums text-gold-300 sm:text-6xl">
      {v.toFixed(3)} <span className="text-2xl text-gold-300/80">SOL</span>
    </div>
  );
}

export function SettlementCeremony({
  label,
  lamports,
  beneficiary,
  onDone,
}: {
  label: string;
  lamports: number;
  beneficiary: string;
  onDone: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDone, 4200);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <button
      type="button"
      onClick={onDone}
      className="absolute inset-0 z-20 flex cursor-pointer flex-col items-center justify-center bg-bg/95 px-6 text-center backdrop-blur-sm animate-[fade-up_0.35s_ease-out]"
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {Array.from({ length: 18 }).map((_, i) => (
          <span
            key={i}
            className="absolute h-1.5 w-1.5 rounded-full bg-pitch-400 opacity-80"
            style={{
              left: `${8 + ((i * 37) % 84)}%`,
              top: `${10 + ((i * 53) % 70)}%`,
              animation: `fade-up 0.8s ease-out ${i * 40}ms both`,
            }}
          />
        ))}
      </div>
      <p className="text-sm text-muted">&ldquo;{label}&rdquo;</p>
      <p className="mt-1 font-display text-3xl font-extrabold uppercase tracking-wide text-gold-300">
        Verified ✓
      </p>
      <CountUp lamports={lamports} />
      <p className="mt-2 font-mono text-sm text-muted">
        → {truncateAddress(beneficiary, 6)}
      </p>
      <p className="mt-4 text-[11px] text-muted/70">Tap to continue</p>
    </button>
  );
}

export function ProofReceipt({
  status,
  label,
  home,
  away,
  homeGoals,
  awayGoals,
  totalLamports,
  beneficiary,
  txSig,
  pubkey,
  beatTheOddsPct,
}: {
  status: CommitmentStatus;
  label: string;
  home?: string;
  away?: string;
  homeGoals?: number;
  awayGoals?: number;
  totalLamports: number;
  beneficiary: string;
  txSig?: string | null;
  pubkey: string;
  beatTheOddsPct?: number | null;
}) {
  const yes = status === 'Executed';
  return (
    <div className="relative mx-auto max-w-md overflow-hidden rounded-2xl border border-edge bg-surface p-5">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-2 bg-[repeating-linear-gradient(90deg,transparent,transparent_8px,rgb(var(--edge))_8px,rgb(var(--edge))_10px)]"
      />
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-widest text-muted">
          Settlement receipt
        </span>
        <span
          className={`rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase ${
            yes
              ? 'border-gold-500/50 bg-gold-500/10 text-gold-300'
              : 'border-edge text-muted'
          }`}
        >
          {yes ? 'Executed ✓' : status}
        </span>
      </div>
      <p className="mt-3 text-lg font-bold">
        {home && away ? `${home} vs ${away}` : 'Match'}
      </p>
      {homeGoals != null && awayGoals != null && (homeGoals > 0 || awayGoals > 0) && (
        <p className="font-mono text-sm text-muted">
          Final {homeGoals}–{awayGoals}
        </p>
      )}
      <div
        className={`mt-3 rounded-xl border px-3 py-2 text-sm font-semibold ${
          yes
            ? 'border-gold-500/40 bg-gold-500/10 text-gold-300'
            : 'border-edge bg-raised text-muted'
        }`}
      >
        &ldquo;{label}&rdquo; —{' '}
        {yes
          ? 'VERIFIED ✓'
          : status === 'Refunded'
            ? 'not met — pledges refundable'
            : 'voided — pledges reclaimable'}
      </div>
      <ol className="mt-4 flex flex-col gap-1.5 text-xs text-muted">
        <li>✓ Result finalised by TxLINE</li>
        <li>✓ Merkle proof fetched &amp; submitted</li>
        <li>✓ Verified on-chain via validateStatV2 CPI</li>
      </ol>
      {yes && beatTheOddsPct != null && beatTheOddsPct < 50 && (
        <p className="mt-3 text-sm font-bold text-gold-300">
          Beat the odds — the market gave this {Math.round(beatTheOddsPct)}%.
        </p>
      )}
      {yes && (
        <p className="mt-3 border-t border-edge pt-3 font-mono text-sm">
          {formatSol(totalLamports)} SOL →{' '}
          <a
            href={explorerAddressUrl(beneficiary)}
            target="_blank"
            rel="noreferrer"
            className="text-pitch-400 hover:underline"
          >
            {truncateAddress(beneficiary, 4)}
          </a>
        </p>
      )}
      <div className="mt-3 text-sm">
        {txSig ? (
          <a
            href={explorerTxUrl(txSig)}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-pitch-400 hover:underline"
          >
            View on Solana Explorer ↗
          </a>
        ) : (
          <a
            href={explorerAddressUrl(pubkey)}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-pitch-400 hover:underline"
          >
            View commitment on explorer ↗
          </a>
        )}
      </div>
    </div>
  );
}
