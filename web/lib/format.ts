export const LAMPORTS_PER_SOL = 1_000_000_000;

/** Convert lamports to SOL as a number. */
export function lamportsToSol(lamports: number | bigint): number {
  return Number(lamports) / LAMPORTS_PER_SOL;
}

/** Convert a SOL amount to whole lamports (rounds to nearest lamport). */
export function solToLamports(sol: number): number {
  return Math.round(sol * LAMPORTS_PER_SOL);
}

/**
 * Display lamports as SOL with 2–4 decimals: always at least 2, up to 4 when
 * needed to show small amounts (e.g. 0.01 → "0.01", 10500000 → "0.0105").
 */
export function formatSol(lamports: number | bigint): string {
  const sol = lamportsToSol(lamports);
  const rounded4 = Math.round(sol * 10_000) / 10_000;
  const needs4 = Math.round(rounded4 * 100) / 100 !== rounded4;
  return rounded4.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: needs4 ? 4 : 2,
  });
}

export function formatSolAmount(sol: number): string {
  return formatSol(Math.round(sol * LAMPORTS_PER_SOL));
}

export function truncateAddress(address: string, chars = 4): string {
  if (!address) return '';
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}…${address.slice(-chars)}`;
}

export function formatKickoff(kickoffMs: number): string {
  return new Date(kickoffMs).toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function utf8ByteLength(s: string): number {
  return new TextEncoder().encode(s).length;
}

/** Encode a name into a fixed 64-byte zero-padded array (throws if too long). */
export function encodeName64(name: string): number[] {
  const bytes = new TextEncoder().encode(name);
  if (bytes.length > 64) throw new Error('Name exceeds 64 bytes');
  const out = new Array<number>(64).fill(0);
  bytes.forEach((b, i) => (out[i] = b));
  return out;
}

/** Decode a zero-padded 64-byte name array back to a string. */
export function decodeName64(bytes: number[] | Uint8Array): string {
  const arr = Array.from(bytes);
  const end = arr.indexOf(0);
  const slice = end === -1 ? arr : arr.slice(0, end);
  return new TextDecoder().decode(new Uint8Array(slice));
}
