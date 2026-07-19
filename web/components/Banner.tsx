/** "Data may be delayed" banner shown when the indexer is unreachable (§9.8). */
export function DelayedDataBanner({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-400">
      <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-amber-400" />
      Data may be delayed — the indexer is unreachable. On-chain state is unaffected.
    </div>
  );
}
