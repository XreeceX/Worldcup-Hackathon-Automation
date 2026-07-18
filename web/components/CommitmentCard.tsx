import Link from 'next/link';
import { conditionLabel } from '@/lib/conditions';
import { explorerTxUrl } from '@/lib/config';
import { formatKickoff, formatSol, truncateAddress } from '@/lib/format';
import type { BoardCommitment, Fixture } from '@/lib/types';
import { StatusBadge } from './StatusBadge';

export function CommitmentCard({
  commitment,
  fixture,
}: {
  commitment: BoardCommitment;
  fixture?: Fixture;
}) {
  const home = commitment.homeTeam ?? fixture?.homeTeam;
  const away = commitment.awayTeam ?? fixture?.awayTeam;
  const competition = commitment.competition ?? fixture?.competition;
  const label =
    commitment.conditionLabel ??
    conditionLabel(commitment.conditionTemplate, commitment.conditionParam, home, away);
  const fixtureLine = home && away ? `${home} vs ${away}` : `Fixture #${commitment.fixtureId}`;
  const isGroup = commitment.memberCount > 1;

  return (
    <Link
      href={`/commitment/${commitment.pubkey}`}
      className="card group flex flex-col gap-3 p-5 transition-all hover:-translate-y-0.5 hover:border-pitch-700 hover:shadow-glow"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="truncate text-base font-bold leading-tight">
          {commitment.name || label}
        </h3>
        <StatusBadge status={commitment.status} />
      </div>

      <div className="text-sm text-muted">
        <p className="truncate font-semibold text-ink/90">
          {fixtureLine}
          {competition ? <span className="text-muted"> · {competition}</span> : null}
        </p>
        <p className="mt-0.5 text-xs">{formatKickoff(commitment.kickoffTs)}</p>
      </div>

      <p className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-raised px-2.5 py-1 text-xs font-semibold text-pitch-400">
        🎯 {label}
      </p>

      <div className="mt-auto flex items-end justify-between border-t border-edge pt-3">
        <div>
          <p className="font-mono text-xl font-black tabular-nums text-ink">
            {formatSol(commitment.totalLamports)}{' '}
            <span className="text-xs font-bold text-muted">SOL</span>
          </p>
          <p className="text-xs text-muted">
            {isGroup ? `${commitment.memberCount} members` : 'Individual pledge'}
          </p>
        </div>
        <div className="text-right text-xs text-muted">
          <p>to {truncateAddress(commitment.beneficiary)}</p>
          {commitment.status === 'Executed' && commitment.settlementTx && (
            <a
              href={explorerTxUrl(commitment.settlementTx)}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="mt-0.5 inline-block font-semibold text-gold-300 hover:underline"
            >
              Settlement tx ↗
            </a>
          )}
        </div>
      </div>
    </Link>
  );
}
