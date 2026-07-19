"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useBoard, useFixtures, useFeed, fixtureLabel } from "@/lib/api";
import { CommitmentCard } from "@/components/commitment-card";
import { TxLink } from "@/components/chrome";
import { fmtSol, truncate } from "@/lib/config";

const FILTERS = ["All", "Live", "Upcoming", "Settled"] as const;

export default function Board() {
  const { data: rows, isLoading } = useBoard();
  const { fixtures } = useFixtures();
  const feed = useFeed();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [sort, setSort] = useState("total_lamports");

  const filtered = useMemo(() => {
    const now = Date.now() / 1000;
    let r = rows ?? [];
    if (filter === "Live") r = r.filter((x) => x.status === "Open" && now >= x.kickoffTs);
    if (filter === "Upcoming") r = r.filter((x) => x.status === "Open" && now < x.kickoffTs);
    if (filter === "Settled") r = r.filter((x) => x.status !== "Open");
    const key = sort === "member_count" ? "memberCount" : sort === "kickoff_ts" ? "kickoffTs" : "totalLamports";
    return [...r].sort((a, b) => (b as never)[key] - (a as never)[key]);
  }, [rows, filter, sort]);

  const totals = useMemo(() => {
    const r = rows ?? [];
    return {
      pledged: r.reduce((s, x) => s + x.totalLamports, 0),
      count: r.length,
      released: r.filter((x) => x.status === "Executed").reduce((s, x) => s + x.totalLamports, 0),
    };
  }, [rows]);

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
      <div>
        {/* hero strip */}
        <div className="flex flex-wrap items-end justify-between gap-4 py-4">
          <div>
            <h1 className="display text-3xl font-extrabold">Put it on the line.</h1>
            <p className="mt-1 max-w-md text-sm text-chalk-400">
              Conditional pledges, settled by the final whistle. No bookmaker. No committee. Just proof.
            </p>
          </div>
          <div className="flex gap-6">
            <Stat label="On the line" value={fmtSol(totals.pledged)} />
            <Stat label="Commitments" value={String(totals.count)} />
            <Stat label="Released to causes" value={fmtSol(totals.released)} gold />
          </div>
        </div>

        {/* filter bar */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-line-600 bg-pitch-800 p-0.5">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                  filter === f ? "bg-pitch-700 text-chalk-100" : "text-chalk-400 hover:text-chalk-100"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="ml-auto rounded-lg border border-line-600 bg-pitch-800 px-3 py-1.5 text-xs text-chalk-400"
          >
            <option value="total_lamports">Biggest pledge</option>
            <option value="member_count">Most members</option>
            <option value="kickoff_ts">Kickoff time</option>
          </select>
        </div>

        {/* grid */}
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-44 animate-pulse rounded-xl border border-line-600 bg-pitch-800" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line-600 bg-pitch-900 p-12 text-center">
            <p className="display text-xl text-chalk-400">No pledges yet. The board is waiting.</p>
            <Link
              href="/matches"
              className="mt-4 inline-block rounded-lg bg-turf-500 px-5 py-2.5 font-semibold text-pitch-950"
            >
              Make the first vow
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((row, i) => (
              <CommitmentCard key={row.pubkey} row={row} fixtures={fixtures} index={i} />
            ))}
          </div>
        )}
      </div>

      {/* feed rail */}
      <aside className="hidden xl:block">
        <div className="label mb-3">Settlement feed</div>
        <div className="flex flex-col gap-2">
          {feed.length === 0 && (
            <p className="text-sm text-chalk-600">Resolutions appear here in real time.</p>
          )}
          {feed.map((e, i) => {
            const f = fixtureLabel(fixtures, e.fixtureId);
            return (
              <div key={i} className="rounded-lg border border-line-600 bg-pitch-800 p-3 text-xs">
                <div className={e.conditionMet ? "font-semibold text-gold-400" : "text-chalk-400"}>
                  {e.conditionMet ? "RELEASED" : "NOT MET"} · {e.name || "pledge"}
                </div>
                <div className="mt-0.5 text-chalk-400">
                  {f.home} vs {f.away} · → {truncate(e.beneficiary)}
                </div>
                {e.txSig && <div className="mt-1"><TxLink sig={e.txSig}>explorer ↗</TxLink></div>}
              </div>
            );
          })}
        </div>
      </aside>
    </div>
  );
}

function Stat({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <div className="text-right">
      <div className="label">{label}</div>
      <div className={`mono text-xl font-semibold ${gold ? "text-gold-400" : ""}`}>{value}</div>
    </div>
  );
}
