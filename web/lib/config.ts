export const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ?? 'https://api.devnet.solana.com';

export const PROGRAM_ID =
  process.env.NEXT_PUBLIC_PROGRAM_ID ??
  '3uyiF93zMvUcP2o1Cqnt2iS4bXwYeBcTMTvbaTf5B3RJ';

export const INDEXER_URL =
  process.env.NEXT_PUBLIC_INDEXER_URL ?? 'http://localhost:3002';

export const KEEPER_URL =
  process.env.NEXT_PUBLIC_KEEPER_URL ?? 'http://localhost:3001';

export const MIN_DEPOSIT_SOL = 0.01;
export const MIN_DEPOSIT_LAMPORTS = 10_000_000;
export const MAX_NAME_BYTES = 64;
export const TIMEOUT_SECONDS = 7 * 86_400;

export function explorerTxUrl(sig: string): string {
  return `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
}

export function explorerAddressUrl(address: string): string {
  return `https://explorer.solana.com/address/${address}?cluster=devnet`;
}
