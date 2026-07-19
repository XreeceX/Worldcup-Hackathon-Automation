'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import type { WalletName } from '@solana/wallet-adapter-base';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { toastError, toastSuccess } from './toast';

/** Phantom / Solflare connect menu. Wallet address stays truncated — never shown in full. */
export function ConnectMenu() {
  const { connection } = useConnection();
  const {
    wallets,
    select,
    connect,
    disconnect,
    connected,
    connecting,
    publicKey,
    wallet,
  } = useWallet();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [pendingName, setPendingName] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const refreshBalance = useCallback(async () => {
    if (!publicKey) {
      setBalance(null);
      return;
    }
    try {
      const lamports = await connection.getBalance(publicKey, 'confirmed');
      setBalance(lamports / LAMPORTS_PER_SOL);
    } catch {
      setBalance(null);
    }
  }, [connection, publicKey]);

  useEffect(() => {
    void refreshBalance();
    if (!publicKey) return;
    const id = setInterval(() => void refreshBalance(), 15_000);
    return () => clearInterval(id);
  }, [publicKey, refreshBalance]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useEffect(() => {
    if (!pendingName || !wallet) return;
    if (wallet.adapter.name !== pendingName) return;

    let cancelled = false;
    (async () => {
      setBusy(true);
      try {
        if (!wallet.adapter.connected) {
          await connect();
        }
        if (cancelled) return;
        setOpen(false);
        toastSuccess('Wallet connected');
        await refreshBalance();
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : String(e);
          toastError(msg.includes('rejected') ? 'Connection cancelled.' : msg);
        }
      } finally {
        if (!cancelled) {
          setBusy(false);
          setPendingName(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pendingName, wallet, connect, refreshBalance]);

  const connectNamed = useCallback(
    (name: string) => {
      const entry = wallets.find((w) => w.adapter.name === name);
      if (!entry) {
        toastError(`${name} is not available in this browser`);
        return;
      }
      setBusy(true);
      setPendingName(name);
      select(entry.adapter.name as WalletName);
    },
    [wallets, select],
  );

  if (connected && publicKey) {
    const short = `${publicKey.toBase58().slice(0, 4)}…${publicKey.toBase58().slice(-4)}`;
    return (
      <div className="relative" ref={rootRef}>
        <button
          type="button"
          className="btn-secondary !h-[42px] !gap-2 !px-3"
          onClick={() => setOpen((v) => !v)}
        >
          <span className="h-2 w-2 rounded-full bg-pitch-400" />
          <span className="font-mono text-xs">{short}</span>
          {balance != null && (
            <span className="text-xs text-pitch-400">{balance.toFixed(2)} SOL</span>
          )}
        </button>
        {open && (
          <div className="absolute right-0 z-[100] mt-2 w-48 rounded-xl border border-edge bg-surface p-2 shadow-xl">
            <button
              type="button"
              className="btn-secondary mb-1 w-full !justify-start"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(publicKey.toBase58());
                  toastSuccess('Address copied');
                } catch {
                  toastError('Clipboard unavailable — copy from your wallet app');
                }
                setOpen(false);
              }}
            >
              Copy address
            </button>
            <button
              type="button"
              className="btn-danger w-full !justify-start"
              onClick={async () => {
                await disconnect();
                setOpen(false);
              }}
            >
              Disconnect
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className="btn-primary !h-[42px]"
        disabled={busy || connecting}
        onClick={() => setOpen((v) => !v)}
      >
        {busy || connecting ? 'Connecting…' : 'Connect'}
      </button>
      {open && (
        <div className="absolute right-0 z-[100] mt-2 w-64 rounded-xl border border-edge bg-surface p-2 shadow-xl">
          <div className="px-2 py-1.5 text-[11px] uppercase tracking-wider text-muted">
            Connect wallet
          </div>
          <button
            type="button"
            className="btn-secondary mb-1 w-full !justify-start"
            disabled={busy}
            onClick={() => connectNamed('Phantom')}
          >
            Phantom
          </button>
          <button
            type="button"
            className="btn-secondary w-full !justify-start"
            disabled={busy}
            onClick={() => connectNamed('Solflare')}
          >
            Solflare
          </button>
          <p className="mt-2 px-2 text-[11px] text-muted">
            Use <strong>Devnet</strong> in your wallet settings.
          </p>
        </div>
      )}
    </div>
  );
}
