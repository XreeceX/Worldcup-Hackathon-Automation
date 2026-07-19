"use client";
import Link from "next/link";
import { useBoard, useFixtures } from "@/lib/api";
import { flag } from "@/lib/config";

export default function Matches() {
  const { fixtures } = useFixtures();
  const { data: rows } = useBoard();
  const now = Date.now();
  const groups: [string, typeof fixtures][] = [
    ["Recently finished", fixtures.filter((f) => f.startTime <= now - 2 * 3600_000)],
    ["Today & upcoming", fixtures.filter((f) => f.startTime > now - 2 * 3600_000)],
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="display py-4 text-2xl font-extrabold">Matches</h1>
      {groups.map(([label, list]) =>
        list.length === 0 ? null : (
          <section key={label} className="mb-8">
            <div className="label mb-2">{label}</div>
            <div className="flex flex-col gap-2">
              {list
                .sort((a, b) => a.startTime - b.startTime)
                .map((f) => {
                  const count = (rows ?? []).filter((r) => r.fixtureId === f.fixtureId).length;
                  return (
                    <Link
                      key={f.fixtureId}
                      href={`/fixture/${f.fixtureId}`}
                      className="flex items-center gap-4 rounded-xl border border-line-600 bg-pitch-800 px-4 py-3 transition hover:bg-pitch-700"
                    >
                      <span className="text-lg">{flag(f.home)}</span>
                      <span className="display font-semibold">{f.home}</span>
                      <span className="text-chalk-600">vs</span>
                      <span className="display font-semibold">{f.away}</span>
                      <span className="text-lg">{flag(f.away)}</span>
                      <span className="ml-auto text-right text-xs text-chalk-400">
                        {new Date(f.startTime).toLocaleString(undefined, {
                          weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                        })}
                        {count > 0 && <div className="mt-0.5 text-turf-400">{count} pledge{count > 1 ? "s" : ""}</div>}
                      </span>
                    </Link>
                  );
                })}
            </div>
          </section>
        )
      )}
    </div>
  );
}
