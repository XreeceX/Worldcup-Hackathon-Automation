"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { StatusChip } from "./chrome";
import { conditionLabel } from "@/lib/conditions";
import { fmtSol, truncate, flag } from "@/lib/config";
import type { BoardRow, Fixture } from "@/lib/api";
import { fixtureLabel } from "@/lib/api";

export function CommitmentCard({ row, fixtures, index = 0 }: { row: BoardRow; fixtures: Fixture[]; index?: number }) {
  const f = fixtureLabel(fixtures, row.fixtureId);
  const live = row.status === "Open" && Date.now() / 1000 >= row.kickoffTs;
  const label = conditionLabel(row.conditionTemplate, row.conditionParam, f.home, f.away);
  const kickoff = new Date(row.kickoffTs * 1000);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      <Link
        href={`/commitment/${row.pubkey}`}
        className="block rounded-xl border border-line-600 bg-pitch-800 p-4 transition hover:-translate-y-0.5 hover:bg-pitch-700"
      >
        <div className="flex items-center justify-between">
          <StatusChip status={row.status} live={live} />
          {row.memberCount > 1 && (
            <span className="text-xs text-chalk-400">{row.memberCount} members</span>
          )}
        </div>
        <div className="display mt-2 truncate text-lg font-semibold">
          {row.name || `${label} pledge`}
        </div>
        <div className="mt-0.5 text-sm text-chalk-400">
          {flag(f.home)} {f.home} vs {f.away} {flag(f.away)}
          <span className="text-chalk-600">
            {" · "}
            {kickoff.toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
        <div className="mt-1 text-sm text-chalk-100">&ldquo;{label}&rdquo;</div>
        <div className="mt-3 flex items-end justify-between">
          <span className="mono text-2xl font-semibold">{fmtSol(row.totalLamports)}</span>
          <span className="mono text-xs text-chalk-600">→ {truncate(row.beneficiary)}</span>
        </div>
      </Link>
    </motion.div>
  );
}
