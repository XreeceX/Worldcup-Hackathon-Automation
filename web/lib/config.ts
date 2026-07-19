export const KEEPER_URL = process.env.NEXT_PUBLIC_KEEPER_URL ?? "http://localhost:3001";
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? "https://api.devnet.solana.com";
export const CLUSTER_PARAM = "?cluster=devnet";

export const explorerTx = (sig: string) => `https://explorer.solana.com/tx/${sig}${CLUSTER_PARAM}`;
export const explorerAddr = (addr: string) => `https://explorer.solana.com/address/${addr}${CLUSTER_PARAM}`;

export const truncate = (s: string, n = 4) => (s.length > 2 * n + 1 ? `${s.slice(0, n)}…${s.slice(-n)}` : s);

export const lamportsToSol = (l: number) => l / 1_000_000_000;
export const fmtSol = (l: number) =>
  `${lamportsToSol(l).toLocaleString(undefined, { maximumFractionDigits: 3 })} SOL`;

// Fixture metadata fallback for fixtures not in the live snapshot (e.g. the
// finished replay fixture). Team names only — no licensed marks.
export const FIXTURES_EXTRA: Record<number, { home: string; away: string; startTime: number }> = {
  18241006: { home: "England", away: "Argentina", startTime: 1784142000000 },
};

export const FLAGS: Record<string, string> = {
  England: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", Argentina: "🇦🇷", France: "🇫🇷", Spain: "🇪🇸", Brazil: "🇧🇷",
  Australia: "🇦🇺", "New Zealand": "🇳🇿", India: "🇮🇳", Vietnam: "🇻🇳", Myanmar: "🇲🇲",
  Liechtenstein: "🇱🇮", Gibraltar: "🇬🇮",
};
export const flag = (team: string) => FLAGS[team] ?? "⚽";
