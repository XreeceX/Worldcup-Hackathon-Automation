import { INDEXER_URL, KEEPER_URL } from './config';
import {
  EST_FULL_TIME_MS,
  MATCH_WINDOW_MS,
  applyScoreLifecycle,
  fixtureBucket,
} from './fixtures';
import { buildMatchFromRecords } from './matchData';
import type { BoardCommitment, ClaimRow, Fixture } from './types';
import { enrichFixtureMeta, mergeWithWcSchedule } from './wcSchedule';

/** Recursively camelise snake_case keys so the UI is agnostic to API casing. */
export function camelise<T = unknown>(value: unknown): T {
  if (Array.isArray(value)) return value.map((v) => camelise(v)) as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const ck = k.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
      out[ck] = camelise(v);
    }
    return out as T;
  }
  return value as T;
}

async function getJson<T>(url: string, timeoutMs = 8000): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return camelise<T>(await res.json());
  } finally {
    clearTimeout(timer);
  }
}

function toNum(v: unknown, fallback = 0): number {
  const n = typeof v === 'string' ? Number(v) : (v as number);
  return Number.isFinite(n) ? n : fallback;
}

function normaliseCommitment(raw: Record<string, unknown>): BoardCommitment {
  return {
    ...(raw as unknown as BoardCommitment),
    fixtureId: toNum(raw.fixtureId),
    kickoffTs: toNum(raw.kickoffTs),
    conditionTemplate: toNum(raw.conditionTemplate),
    conditionParam: toNum(raw.conditionParam),
    memberCount: toNum(raw.memberCount),
    totalLamports: toNum(raw.totalLamports),
  };
}

function unwrapList(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    for (const key of ['data', 'commitments', 'rows', 'items', 'claims', 'fixtures']) {
      if (Array.isArray(obj[key])) return obj[key] as Record<string, unknown>[];
    }
  }
  return [];
}

export interface BoardQuery {
  status?: string;
  fixtureId?: number;
  sort?: string;
  limit?: number;
  offset?: number;
}

export async function fetchBoard(q: BoardQuery = {}): Promise<BoardCommitment[]> {
  const params = new URLSearchParams();
  if (q.status) params.set('status', q.status);
  if (q.fixtureId != null) params.set('fixture_id', String(q.fixtureId));
  if (q.sort) params.set('sort', q.sort);
  if (q.limit != null) params.set('limit', String(q.limit));
  if (q.offset != null) params.set('offset', String(q.offset));
  const qs = params.toString();
  const data = await getJson<unknown>(`${INDEXER_URL}/api/board${qs ? `?${qs}` : ''}`);
  return unwrapList(data).map(normaliseCommitment);
}

export async function fetchCommitment(pubkey: string): Promise<BoardCommitment | null> {
  const data = await getJson<unknown>(`${INDEXER_URL}/api/commitment/${pubkey}`);
  if (!data || typeof data !== 'object') return null;
  const obj = data as Record<string, unknown>;
  const row = (obj.data ?? obj.commitment ?? obj) as Record<string, unknown>;
  if (!row || !(row.pubkey || row.fixtureId != null)) return null;
  return normaliseCommitment({ pubkey, ...row });
}

/** Patch in-play / recent kickoffs with TxLINE scores so lists match Match Centre. */
async function hydrateFixtureLifecycle(fixtures: Fixture[]): Promise<Fixture[]> {
  const now = Date.now();
  const candidates = fixtures.filter((f) => {
    const ko = Number(f.kickoffTs);
    if (!Number.isFinite(ko) || ko <= 0 || ko > now) return false;
    if (now - ko > MATCH_WINDOW_MS) return false;
    // Already terminal — nothing to learn from scores.
    if ([5, 10, 13, 15, 16, 100].includes(Number(f.gameState))) return false;
    // Only fixtures that still look live (or have an in-play game_state).
    return fixtureBucket(f, now) === 'live' || Number(f.gameState) >= 2;
  });

  // Force-finish anything past regulation FT with unknown/stale NS state.
  let next = fixtures.map((f) => {
    const ko = Number(f.kickoffTs);
    if (
      Number.isFinite(ko) &&
      ko > 0 &&
      now - ko >= EST_FULL_TIME_MS &&
      now - ko < MATCH_WINDOW_MS &&
      (!Number.isFinite(Number(f.gameState)) || Number(f.gameState) < 2) &&
      f.status !== 'finished'
    ) {
      return { ...f, gameState: 100, status: 'finished' as const };
    }
    return f;
  });

  if (!candidates.length) return next;

  const patches = new Map<number, Fixture>();
  await Promise.all(
    candidates.map(async (f) => {
      try {
        const rows = await fetchScoreFeed(f.fixtureId);
        if (!rows.length) {
          // No score rows after kickoff + regulation → treat as finished once past soft FT.
          if (now - Number(f.kickoffTs) >= EST_FULL_TIME_MS) {
            patches.set(f.fixtureId, {
              ...f,
              gameState: 100,
              status: 'finished',
            });
          }
          return;
        }
        const built = buildMatchFromRecords(rows);
        if (!built.hasData) return;
        patches.set(
          f.fixtureId,
          applyScoreLifecycle(
            f,
            {
              finalised: built.score.finalised,
              statusId: built.score.statusId,
            },
            now,
          ),
        );
      } catch {
        /* score optional */
      }
    }),
  );

  if (!patches.size) return next;
  next = next.map((f) => patches.get(f.fixtureId) ?? f);
  return next;
}

function withDerivedStatus(f: Fixture): Fixture {
  const bucket = fixtureBucket(f);
  return { ...f, status: bucket };
}

export async function fetchFixtures(status?: string): Promise<Fixture[]> {
  const qs = status ? `?status=${status}` : '';
  const data = await getJson<unknown>(`${INDEXER_URL}/api/fixtures${qs}`);
  const mapped = unwrapList(data).map((f) => {
    const base = {
      fixtureId: toNum(f.fixtureId ?? f.id),
      homeTeam: String(f.homeTeam ?? 'Home'),
      awayTeam: String(f.awayTeam ?? 'Away'),
      competition: String(f.competition ?? ''),
      kickoffTs: toNum(f.kickoffTs),
      gameState: toNum(f.gameState),
      // Ignore indexer-derived status — recompute after score hydrate.
      status: undefined as Fixture['status'],
    };
    const meta = enrichFixtureMeta(base);
    return {
      ...base,
      competitionKind: meta.kind,
      stage: meta.stage,
      stageLabel: meta.stageLabel,
      year: meta.year,
    };
  });
  const merged = mergeWithWcSchedule(mapped).map((f) => {
    const meta = enrichFixtureMeta(f);
    return {
      ...f,
      competitionKind: meta.kind,
      stage: meta.stage,
      stageLabel: meta.stageLabel,
      year: meta.year,
    };
  });
  const hydrated = await hydrateFixtureLifecycle(merged);
  const withStatus = hydrated.map(withDerivedStatus);
  if (!status) return withStatus;
  return withStatus.filter((f) => f.status === status);
}

export async function fetchClaims(wallet: string): Promise<ClaimRow[]> {
  const data = await getJson<unknown>(`${INDEXER_URL}/api/claims?wallet=${wallet}`);
  return unwrapList(data).map((c) => ({
    ...(c as unknown as ClaimRow),
    commitmentPubkey: String(c.commitmentPubkey ?? c.pubkey ?? ''),
    wallet: String(c.wallet ?? wallet),
    depositLamports: toNum(c.depositLamports),
    fixtureId: c.fixtureId != null ? toNum(c.fixtureId) : undefined,
  }));
}

/** Keeper manual-resolve fallback (design-01 §10.7). */
export async function requestKeeperResolve(pubkey: string): Promise<{ ok: boolean; message?: string; txSig?: string }> {
  const res = await fetch(`${KEEPER_URL}/api/resolve/${pubkey}`, { method: 'POST' });
  let body: Record<string, unknown> = {};
  try {
    body = camelise(await res.json());
  } catch {
    /* non-JSON response is fine */
  }
  return {
    ok: res.ok,
    message: typeof body.message === 'string' ? body.message : typeof body.error === 'string' ? body.error : undefined,
    txSig: typeof body.txSig === 'string' ? body.txSig : undefined,
  };
}

export function feedUrl(): string {
  return `${KEEPER_URL}/api/feed`;
}

export function liveScoresUrl(fixtureId: number): string {
  return `${KEEPER_URL}/api/scores/live?fixtureId=${fixtureId}`;
}

function asRecordRows(data: unknown): Record<string, unknown>[] {
  if (!data) return [];
  if (Array.isArray(data)) {
    return data.filter((r): r is Record<string, unknown> => !!r && typeof r === 'object');
  }
  if (typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.data)) {
      return obj.data.filter((r): r is Record<string, unknown> => !!r && typeof r === 'object');
    }
    return [obj];
  }
  return [];
}

/**
 * Full match feed (historical + snapshot) for rich timelines.
 * Falls back to snapshot-only if the feed route is unavailable.
 */
export async function fetchScoreFeed(
  fixtureId: number,
): Promise<Record<string, unknown>[]> {
  try {
    const data = await getJson<unknown>(
      `${KEEPER_URL}/api/scores/feed/${fixtureId}`,
      15_000,
    );
    const rows = asRecordRows(data);
    if (rows.length) return rows;
  } catch {
    /* fall through to snapshot */
  }
  try {
    const snap = await getJson<unknown>(
      `${KEEPER_URL}/api/scores/snapshot/${fixtureId}`,
      10_000,
    );
    return asRecordRows(snap);
  } catch {
    return [];
  }
}

/** Market pulse odds (TxLINE StablePrice demargined %). */
export async function fetchOdds(
  fixtureId: number,
): Promise<import('./odds').MarketOdds | null> {
  const bases = [INDEXER_URL, ''];
  for (const base of bases) {
    try {
      return await getJson(`${base}/api/odds/${fixtureId}`);
    } catch {
      /* try next */
    }
  }
  return null;
}
