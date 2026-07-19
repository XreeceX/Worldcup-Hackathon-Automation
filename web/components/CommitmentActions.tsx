'use client';

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useEscrow } from '@/hooks/useEscrow';
import { requestKeeperResolve } from '@/lib/api';
import { MIN_DEPOSIT_SOL, TIMEOUT_SECONDS, MATCH_WINDOW_SECONDS } from '@/lib/config';
import { solToLamports } from '@/lib/format';
import type { OnChainCommitment } from '@/lib/escrow';
import { toastTxError, toastTxSuccess } from './toast';
import toast from 'react-hot-toast';

interface ActionProps {
  commitment: OnChainCommitment;
  onChanged: () => void;
}

function useMemberEntry(commitment: OnChainCommitment) {
  const { publicKey } = useWallet();
  const wallet = publicKey?.toBase58();
  return wallet ? commitment.members.find((m) => m.wallet === wallet) : undefined;
}

export function JoinButton({ commitment, onChanged }: ActionProps) {
  const { connected, publicKey } = useWallet();
  const { setVisible } = useWalletModal();
  const escrow = useEscrow();
  const entry = useMemberEntry(commitment);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);

  const withinMatchWindow =
    Date.now() / 1000 < commitment.kickoffTs + MATCH_WINDOW_SECONDS;
  if (commitment.status !== 'Open' || !withinMatchWindow) return null;
  if (entry && !entry.withdrawn) return null; // already an active member
  if (entry?.withdrawn) {
    return (
      <p className="text-xs text-muted">
        You withdrew from this commitment — rejoining is not allowed.
      </p>
    );
  }
  if (publicKey && publicKey.toBase58() === commitment.beneficiary) {
    return (
      <p className="text-xs text-muted">
        This wallet is the beneficiary — a pledge pays someone else, so the
        beneficiary can&apos;t pledge into its own commitment.
      </p>
    );
  }

  const amountNum = Number(amount);
  const valid = Number.isFinite(amountNum) && amountNum >= MIN_DEPOSIT_SOL;

  async function join() {
    if (!connected || !escrow) {
      setVisible(true);
      return;
    }
    if (!valid) return;
    setBusy(true);
    try {
      const sig = await escrow.joinCommitment(commitment.pubkey, solToLamports(amountNum));
      toastTxSuccess(`Joined with ${amountNum} SOL.`, sig);
      setAmount('');
      onChanged();
    } catch (err) {
      toastTxError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        aria-label="Deposit amount in SOL"
        className="input w-36 font-mono"
        type="number"
        min={MIN_DEPOSIT_SOL}
        step="0.01"
        placeholder={`min ${MIN_DEPOSIT_SOL}`}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <button className="btn-primary" disabled={busy || (connected && !valid)} onClick={join}>
        {busy ? 'Confirming…' : connected ? 'Join commitment' : 'Connect to join'}
      </button>
      {amount && !valid && (
        <span className="text-xs text-red-400">Minimum deposit is 0.01 SOL.</span>
      )}
    </div>
  );
}

export function WithdrawButton({ commitment, onChanged }: ActionProps) {
  const escrow = useEscrow();
  const entry = useMemberEntry(commitment);
  const [busy, setBusy] = useState(false);

  const beforeKickoff = Date.now() / 1000 < commitment.kickoffTs;
  if (commitment.status !== 'Open' || !beforeKickoff) return null;
  if (!entry || entry.withdrawn || entry.claimed) return null;

  async function withdraw() {
    if (!escrow) return;
    setBusy(true);
    try {
      const sig = await escrow.withdraw(commitment.pubkey);
      toastTxSuccess('Deposit withdrawn.', sig);
      onChanged();
    } catch (err) {
      toastTxError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button className="btn-secondary" disabled={busy} onClick={withdraw}>
      {busy ? 'Confirming…' : 'Withdraw my deposit'}
    </button>
  );
}

/** Manual keeper-fallback resolve (§10.7) — any connected wallet, post-kickoff. */
export function ResolveButton({ commitment, onChanged }: ActionProps) {
  const { connected } = useWallet();
  const { setVisible } = useWalletModal();
  const [busy, setBusy] = useState(false);

  const pastKickoff = Date.now() / 1000 >= commitment.kickoffTs;
  if (commitment.status !== 'Open' || !pastKickoff) return null;

  async function resolve() {
    if (!connected) {
      setVisible(true);
      return;
    }
    setBusy(true);
    try {
      const res = await requestKeeperResolve(commitment.pubkey);
      if (res.ok) {
        if (res.txSig) toastTxSuccess('Resolution submitted.', res.txSig);
        else toast.success('Resolution requested — the keeper is fetching the match proof.');
        onChanged();
      } else {
        toast.error(res.message ?? 'Keeper could not resolve — is the match finalised?');
      }
    } catch {
      toast.error('Keeper unreachable. Resolution stays permissionless — try again shortly.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button className="btn-primary" disabled={busy} onClick={resolve}>
        {busy ? 'Requesting…' : 'Resolve now'}
      </button>
      <p className="mt-1.5 text-xs text-muted">
        Normally automatic — use this if the keeper missed the final whistle.
      </p>
    </div>
  );
}

/** 7-day timeout escape hatch — members only, direct void_timeout tx. */
export function VoidButton({ commitment, onChanged }: ActionProps) {
  const escrow = useEscrow();
  const entry = useMemberEntry(commitment);
  const [busy, setBusy] = useState(false);

  const timeoutReached = Date.now() / 1000 >= commitment.kickoffTs + TIMEOUT_SECONDS;
  if (commitment.status !== 'Open' || !timeoutReached) return null;
  if (!entry || entry.withdrawn) return null;

  async function voidTimeout() {
    if (!escrow) return;
    setBusy(true);
    try {
      const sig = await escrow.voidTimeout(commitment.pubkey);
      toastTxSuccess('Commitment voided — refunds are open.', sig);
      onChanged();
    } catch (err) {
      toastTxError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button className="btn-danger" disabled={busy} onClick={voidTimeout}>
        {busy ? 'Confirming…' : 'Force void (7-day timeout)'}
      </button>
      <p className="mt-1.5 text-xs text-muted">
        7+ days past kickoff with no resolution — any member can unlock refunds.
      </p>
    </div>
  );
}

export function ClaimRefundButton({ commitment, onChanged }: ActionProps) {
  const escrow = useEscrow();
  const entry = useMemberEntry(commitment);
  const [busy, setBusy] = useState(false);

  if (commitment.status !== 'Refunded' && commitment.status !== 'Void') return null;
  if (!entry || entry.withdrawn || entry.claimed) return null;

  async function claim() {
    if (!escrow) return;
    setBusy(true);
    try {
      const sig = await escrow.claimRefund(commitment.pubkey);
      toastTxSuccess('Refund claimed — SOL returned to your wallet.', sig);
      onChanged();
    } catch (err) {
      toastTxError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button className="btn-primary" disabled={busy} onClick={claim}>
      {busy ? 'Confirming…' : 'Claim my refund'}
    </button>
  );
}
