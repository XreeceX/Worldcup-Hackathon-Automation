'use client';

import Link from 'next/link';
import { useClaims } from '@/hooks/useClaims';
import { formatSol } from '@/lib/format';

/** Pending-refund pill in the header; polls /api/claims every 30s (FR-12.3). */
export function ClaimsBadge() {
  const { claims, wallet } = useClaims();
  if (!wallet || claims.length === 0) return null;
  const total = claims.reduce((sum, c) => sum + c.depositLamports, 0);
  return (
    <Link
      href="/claims"
      className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-400 transition-colors hover:bg-amber-500/20"
    >
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
      {claims.length} pending claim{claims.length > 1 ? 's' : ''} · {formatSol(total)} SOL
    </Link>
  );
}
