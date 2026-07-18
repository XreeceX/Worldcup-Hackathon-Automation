import type { CommitmentStatus } from '@/lib/types';

const STYLES: Record<CommitmentStatus, string> = {
  Open: 'bg-pitch-500/15 text-pitch-400 border-pitch-600/40',
  Executed: 'bg-gold-500/15 text-gold-300 border-gold-500/40',
  Refunded: 'bg-amber-500/15 text-amber-400 border-amber-500/40',
  Void: 'bg-white/5 text-muted border-edge',
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
