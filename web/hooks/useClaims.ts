'use client';

import { useCallback, useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { fetchClaims } from '@/lib/api';
import type { ClaimRow } from '@/lib/types';

const POLL_MS = 30_000;

/** Pending refunds for the connected wallet, polled every 30s (FR-12.3). */
export function useClaims() {
  const { publicKey } = useWallet();
  const wallet = publicKey?.toBase58() ?? null;
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    if (!wallet) {
      setClaims([]);
      return;
    }
    try {
      setClaims(await fetchClaims(wallet));
      setError(false);
    } catch {
      setError(true);
    }
  }, [wallet]);

  useEffect(() => {
    if (!wallet) {
      setClaims([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    refresh().finally(() => {
      if (!cancelled) setLoading(false);
    });
    const timer = setInterval(refresh, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [wallet, refresh]);

  return { claims, loading, error, refresh, wallet };
}
