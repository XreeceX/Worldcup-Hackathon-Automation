"use client";
import useSWR from "swr";
import { useEffect, useRef, useState } from "react";
import { KEEPER_URL, FIXTURES_EXTRA } from "./config";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export type BoardRow = {
  pubkey: string; fixtureId: number; kickoffTs: number;
  conditionTemplate: number; conditionParam: number; conditionType: string;
  beneficiary: string; founder: string; name: string; status: string;
  memberCount: number; totalLamports: number;
};
export type CommitmentDetail = BoardRow & {
  members: { wallet: string; depositLamports: number; withdrawn: boolean; claimed: boolean }[];
};
export type Fixture = { fixtureId: number; home: string; away: string; startTime: number };
export type Claim = {
  pubkey: string; fixtureId: number; name: string; conditionType: string;
  status: string; amountLamports: number;
};
export type FeedEvent = {
  type: string; commitment: string; fixtureId: number; name: string;
  conditionMet: boolean; status: string; beneficiary: string; txSig: string; ts: number;
};

export function useBoard(params = "") {
  return useSWR<BoardRow[]>(`${KEEPER_URL}/api/board${params}`, fetcher, { refreshInterval: 5000 });
}
export function useCommitment(pubkey?: string) {
  return useSWR<CommitmentDetail>(pubkey ? `${KEEPER_URL}/api/commitment/${pubkey}` : null, fetcher, { refreshInterval: 4000 });
}
export function useFixtures() {
  const swr = useSWR<Fixture[]>(`${KEEPER_URL}/api/fixtures`, fetcher, { refreshInterval: 300000 });
  const merged = [
    ...Object.entries(FIXTURES_EXTRA).map(([id, f]) => ({ fixtureId: Number(id), ...f })),
    ...(swr.data ?? []),
  ];
  const seen = new Set<number>();
  const fixtures = merged.filter((f) => (seen.has(f.fixtureId) ? false : (seen.add(f.fixtureId), true)));
  return { ...swr, fixtures };
}
export function useClaims(wallet?: string) {
  return useSWR<Claim[]>(wallet ? `${KEEPER_URL}/api/claims?wallet=${wallet}` : null, fetcher, { refreshInterval: 8000 });
}

export function fixtureLabel(fixtures: Fixture[], fixtureId: number) {
  const f = fixtures.find((x) => x.fixtureId === fixtureId);
  return f ? { home: f.home, away: f.away, startTime: f.startTime } : { home: "Home", away: "Away", startTime: 0 };
}

// --- SSE hooks ---
export function useFeed(onEvent?: (e: FeedEvent) => void) {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const cb = useRef(onEvent);
  cb.current = onEvent;
  useEffect(() => {
    const es = new EventSource(`${KEEPER_URL}/api/feed`);
    es.onmessage = (m) => {
      try {
        const e = JSON.parse(m.data) as FeedEvent;
        setEvents((prev) => [e, ...prev].slice(0, 50));
        cb.current?.(e);
      } catch {}
    };
    return () => es.close();
  }, []);
  return events;
}

export type ScoreState = {
  g1: number; g2: number; clock: string; phase: string;
  events: { action: string; team?: 1 | 2; ts: number }[];
  connected: boolean;
};

export function useLiveScore(fixtureId?: number): ScoreState {
  const [state, setState] = useState<ScoreState>({ g1: 0, g2: 0, clock: "", phase: "", events: [], connected: false });
  useEffect(() => {
    if (!fixtureId) return;
    const es = new EventSource(`${KEEPER_URL}/api/scores/live?fixtureId=${fixtureId}`);
    es.onopen = () => setState((s) => ({ ...s, connected: true }));
    es.onerror = () => setState((s) => ({ ...s, connected: false }));
    es.onmessage = (m) => {
      try {
        const d = JSON.parse(m.data);
        setState((s) => {
          const g1 = d.Stats?.["1"] ?? s.g1;
          const g2 = d.Stats?.["2"] ?? s.g2;
          const action = d.Action ?? "";
          const phase =
            action === "game_finalised" ? "FT"
            : action === "halftime_finalised" ? "HT"
            : action === "kickoff" ? "LIVE"
            : s.phase || "";
          const isEvent = ["goal", "yellow_card", "red_card", "corner", "kickoff", "halftime_finalised", "game_finalised"].includes(action);
          const events = isEvent ? [{ action, ts: d.Ts ?? Date.now() }, ...s.events].slice(0, 12) : s.events;
          return { ...s, g1, g2, phase, events, connected: true };
        });
      } catch {}
    };
    return () => es.close();
  }, [fixtureId]);
  return state;
}

export async function triggerResolve(pubkey: string) {
  const res = await fetch(`${KEEPER_URL}/api/resolve/${pubkey}`, { method: "POST" });
  if (!res.ok) throw new Error((await res.json()).error ?? "resolve failed");
  return res.json();
}
export async function runReplay(speedMs = 150) {
  await fetch(`${KEEPER_URL}/api/replay/run?speedMs=${speedMs}`, { method: "POST" });
}
