import Link from 'next/link';
import { CountryFlag } from '@/components/CountryFlag';
import { StatusBadge } from '@/components/StatusBadge';
import { conditionLabel } from '@/lib/conditions';
import { explorerTxUrl } from '@/lib/config';
import { formatKickoff, formatSol, truncateAddress } from '@/lib/format';
import type { BoardCommitment, Fixture } from '@/lib/types';

export function CommitmentCard({
  commitment,
  fixture,
}: {
  commitment: BoardCommitment;
  fixture?: Fixture;
}) {
  const home = commitment.homeTeam ?? fixture?.homeTeam;
  const away = commitment.awayTeam ?? fixture?.awayTeam;
  const label =
    commitment.conditionLabel ??
    conditionLabel(commitment.conditionTemplate, commitment.conditionParam, home, away);
  const isGroup = commitment.memberCount > 1;
  const title = commitment.name || label;

  return (
    <Link
      href={`/commitment/${commitment.pubkey}`}
      className="card flex h-full flex-col gap-3 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-pitch-700/70 hover:bg-raised/40 sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-display text-lg font-extrabold uppercase tracking-wide leading-snug">
            {title}
          </h3>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-muted">
            {home && away ? (
              <>
                <CountryFlag team={home} size={14} />
                <span className="font-semibold text-ink/85">{home}</span>
                <span>vs</span>
                <CountryFlag team={away} size={14} />
                <span className="font-semibold text-ink/85">{away}</span>
              </>
            ) : (
              <span>Fixture #{commitment.fixtureId}</span>
            )}
          </p>
          <p className="mt-0.5 text-[11px] text-muted">
            {formatKickoff(commitment.kickoffTs)}
          </p>
        </div>
        <StatusBadge status={commitment.status} />
      </div>

      <p className="text-sm font-semibold text-pitch-400">{label}</p>

      <div className="mt-auto flex items-end justify-between gap-3 border-t border-edge pt-3">
        <div>
          <p className="font-mono text-xl font-black tabular-nums">
            {formatSol(commitment.totalLamports)}{' '}
            <span className="text-xs font-bold text-muted">SOL</span>
          </p>
          <p className="text-[11px] text-muted">
            {isGroup ? `${commitment.memberCount} members` : 'Solo'}
            {' · '}
            to {truncateAddress(commitment.beneficiary, 4)}
          </p>
        </div>
        {commitment.status === 'Executed' && commitment.settlementTx ? (
          <a
            href={explorerTxUrl(commitment.settlementTx)}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="shrink-0 text-[11px] font-bold text-pitch-400 hover:underline"
          >
            Tx ↗
          </a>
        ) : (
          <span className="shrink-0 text-[11px] font-bold text-muted">Open →</span>
        )}
      </div>
    </Link>
  );
}
