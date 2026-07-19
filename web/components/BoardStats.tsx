import { formatSol } from '@/lib/format';
import type { BoardCommitment } from '@/lib/types';

export function BoardStats({ rows }: { rows: BoardCommitment[] }) {
  const open = rows.filter((r) => r.status === 'Open');
  const onTheLine = open.reduce((s, r) => s + r.totalLamports, 0);
  const released = rows
    .filter((r) => r.status === 'Executed')
    .reduce((s, r) => s + r.totalLamports, 0);

  return (
    <div className="flex flex-wrap gap-6 sm:gap-8">
      <Stat label="On the line" value={`${formatSol(onTheLine)} SOL`} />
      <Stat label="Pledges" value={String(rows.length)} />
      <Stat label="Released" value={`${formatSol(released)} SOL`} accent />
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-widest text-muted">
        {label}
      </p>
      <p
        className={`mt-0.5 font-mono text-xl font-black tabular-nums sm:text-2xl ${
          accent ? 'text-gold-300' : ''
        }`}
      >
        {value}
      </p>
    </div>
  );
}
