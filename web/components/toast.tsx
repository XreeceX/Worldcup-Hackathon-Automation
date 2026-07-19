import toast from 'react-hot-toast';
import { explorerTxUrl } from '@/lib/config';
import { programErrorMessage } from '@/lib/programErrors';

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

/** Map wallet/Anchor errors to fan-facing copy. */
export function toastTxError(err: unknown) {
  toast.error(programErrorMessage(err), { duration: 8_000 });
  // eslint-disable-next-line no-console
  console.error('Transaction error:', err);
}
