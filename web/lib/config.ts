export const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ?? 'https://api.devnet.solana.com';

export const PROGRAM_ID =
  process.env.NEXT_PUBLIC_PROGRAM_ID ??
  '3uyiF93zMvUcP2o1Cqnt2iS4bXwYeBcTMTvbaTf5B3RJ';

/**
 * Backend base URLs.
 * - Local: set NEXT_PUBLIC_* to http://localhost:3002 / :3001 in .env.local
 * - Vercel: leave unset → same-origin Next.js /api/* BFF (mirrors indexer+keeper)
 */
const onVercel = Boolean(process.env.NEXT_PUBLIC_VERCEL_ENV);

export const INDEXER_URL =
  process.env.NEXT_PUBLIC_INDEXER_URL ??
  (onVercel ? '' : 'http://localhost:3002');

export const KEEPER_URL =
  process.env.NEXT_PUBLIC_KEEPER_URL ??
  (onVercel ? '' : 'http://localhost:3001');

export const MIN_DEPOSIT_SOL = 0.01;
export const MIN_DEPOSIT_LAMPORTS = 10_000_000;
export const MAX_NAME_BYTES = 64;
export const TIMEOUT_SECONDS = 7 * 86_400;
/** Create/join allowed through kickoff + this window (mirrors on-chain). */
export const MATCH_WINDOW_SECONDS = 3.5 * 60 * 60;

export function explorerTxUrl(sig: string): string {
  return `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
}

export function explorerAddressUrl(address: string): string {
  return `https://explorer.solana.com/address/${address}?cluster=devnet`;
}
