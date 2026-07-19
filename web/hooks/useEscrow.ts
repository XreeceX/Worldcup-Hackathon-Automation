'use client';

import { useMemo } from 'react';
import {
  useAnchorWallet,
  useConnection,
  useWallet,
} from '@solana/wallet-adapter-react';
import type { AnchorWallet } from '@solana/wallet-adapter-react';
import { AnchorEscrow, type EscrowInterface } from '@/lib/escrow';

/** The sole EscrowInterface wiring (on-chain mode) — null until a signing wallet is ready. */
export function useEscrow(): EscrowInterface | null {
  const { connection } = useConnection();
  const anchorWallet = useAnchorWallet();
  const { publicKey, signTransaction, signAllTransactions } = useWallet();

  // Fallback: some connect races leave useAnchorWallet() null for a tick even though
  // the adapter already exposes signing methods. Build an AnchorWallet from those.
  const wallet = useMemo<AnchorWallet | null>(() => {
    if (anchorWallet) return anchorWallet;
    if (publicKey && signTransaction && signAllTransactions) {
      return { publicKey, signTransaction, signAllTransactions };
    }
    return null;
  }, [anchorWallet, publicKey, signTransaction, signAllTransactions]);

  return useMemo(() => {
    if (!wallet) return null;
    return new AnchorEscrow(connection, wallet);
  }, [connection, wallet]);
}
