import toast from 'react-hot-toast';
import { explorerTxUrl } from '@/lib/config';

export function toastSuccess(message: string, txSig?: string) {
  if (txSig) {
    toastTxSuccess(message, txSig);
    return;
  }
  toast.success(message);
}

export function toastError(message: string) {
  toast.error(message);
}

/** Success toast with a Solana explorer link for the confirmed transaction. */
export function toastTxSuccess(message: string, txSig: string) {
  toast.success(
    <span>
      {message}{' '}
      <a
        href={explorerTxUrl(txSig)}
        target="_blank"
        rel="noreferrer"
        className="font-semibold text-pitch-400 underline underline-offset-2"
      >
        View on explorer ↗
      </a>
    </span>,
    { duration: 8000 },
  );
}

/** Map wallet/Anchor errors to the copy required by design-01 §9.8. */
export function toastTxError(err: unknown) {
  const raw =
    err instanceof Error ? err.message : typeof err === 'string' ? err : '';
  if (/user rejected|rejected the request|cancell?ed|Network mismatch/i.test(raw)) {
    if (/network mismatch|mainnet|devnet/i.test(raw)) {
      toast.error(
        'Wallet is on mainnet — this app uses Solana Devnet. Switch your wallet to Devnet and try again.',
        { duration: 10_000 },
      );
      return;
    }
    toast.error('Transaction cancelled.');
    return;
  }
  if (/member limit/i.test(raw)) {
    toast.error('This DAO has reached its 500-member limit.');
    return;
  }
  if (/insufficient|0 SOL|no record of a prior credit/i.test(raw)) {
    toast.error(
      'Not enough Devnet SOL. Top up at faucet.solana.com and try again.',
      { duration: 10_000 },
    );
    return;
  }
  // AnchorError messages look like "AnchorError ... Error Message: <msg>."
  const anchorMsg = raw.match(/Error Message: (.+?)\.?$/m)?.[1];
  const reason = anchorMsg ?? (raw ? raw.slice(0, 160) : 'unknown error');
  toast.error(`Transaction failed — ${reason}`);
  // eslint-disable-next-line no-console
  console.error('Transaction error:', err);
}
