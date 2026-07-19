import type { CommitmentStatus } from '@/lib/types';

const STYLES: Record<CommitmentStatus, string> = {
  Open: 'bg-pitch-500/15 text-pitch-400 border-pitch-600/40',
  Executed: 'bg-pitch-500/10 text-pitch-300 border-pitch-600/30',
  Refunded: 'bg-rose-500/15 text-rose-300 border-rose-500/35',
  Void: 'bg-rose-500/10 text-rose-200/80 border-rose-500/25',
  Closed: 'bg-white/5 text-muted border-edge',
};

export function StatusBadge({ status }: { status: CommitmentStatus }) {
  const style = STYLES[status] ?? STYLES.Closed;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${style}`}
    >
      {status}
    </span>
  );
}
