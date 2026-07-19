import { NextRequest, NextResponse } from 'next/server';
import {
  MATCH_WINDOW_MS,
  fixtureBucket,
} from '@/lib/fixtures';
import { getFixturesSnapshot, hasTxlineToken } from '@/lib/server/txline';
import {
  WC_2026_SCHEDULE,
  isKnockoutStage,
} from '@/lib/wcSchedule';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GAME_STATE_SHIFT = BigInt(1) << BigInt(48);

function decodePackedFixtureId(packed: bigint | number | string) {
  const p = BigInt(packed);
  return {
    pureFixtureId: Number(p % GAME_STATE_SHIFT),
    gameState: Number(p / GAME_STATE_SHIFT),
  };
}

function statusFor(gameState: number, kickoffTsMs: number, nowMs = Date.now()) {
  return fixtureBucket({ gameState, kickoffTs: kickoffTsMs, status: 'upcoming' }, nowMs);
}

function mapTxlineFixture(raw: Record<string, unknown>) {
  const packed = raw.FixtureId ?? raw.fixtureId ?? raw.fixture_id ?? raw.id;
  if (packed == null) return null;
  let decoded;
  try {
    decoded = decodePackedFixtureId(packed as string | number);
  } catch {
    return null;
  }
  const pick = (...vals: unknown[]) =>
    vals.find((v) => v !== undefined && v !== null && v !== '');
  const teamName = (v: unknown) =>
    typeof v === 'object' && v !== null
      ? pick(
          (v as Record<string, unknown>).name,
          (v as Record<string, unknown>).Name,
        )
      : v;
  const home = teamName(
    pick(raw.participant1, raw.Participant1, raw.homeTeam, raw.HomeTeam),
  );
  const away = teamName(
    pick(raw.participant2, raw.Participant2, raw.awayTeam, raw.AwayTeam),
  );
  const competition = pick(
    raw.competition,
    raw.Competition,
    raw.competitionName,
  );
  const kickoff = pick(
    raw.StartTime,
    raw.startTime,
    raw.start_time,
    raw.kickoff,
    raw.Ts,
  );
  return {
    fixtureId: decoded.pureFixtureId,
    homeTeam: String(home ?? 'Home team'),
    awayTeam: String(away ?? 'Away team'),
    competition: String(competition ?? 'World Cup'),
    kickoffTs: Number(kickoff ?? 0),
    gameState: decoded.gameState,
  };
}

function scheduleFixtures() {
  const now = Date.now();
  return Object.entries(WC_2026_SCHEDULE)
    .filter(([, e]) => isKnockoutStage(e.stage))
    .map(([id, e]) => {
      const kickoffTs = Date.parse(e.kickoffIso);
      return {
        fixtureId: Number(id),
        homeTeam: e.homeTeam,
        awayTeam: e.awayTeam,
        competition: 'World Cup',
        kickoffTs,
        gameState: 0,
        status: statusFor(0, kickoffTs, now),
      };
    });
}

export async function GET(req: NextRequest) {
  try {
    const statusFilter = req.nextUrl.searchParams.get('status');
    if (statusFilter && !['upcoming', 'live', 'finished'].includes(statusFilter)) {
      return NextResponse.json(
        { error: 'status must be upcoming|live|finished' },
        { status: 400 },
      );
    }

    const byId = new Map<number, ReturnType<typeof scheduleFixtures>[number]>();
    for (const f of scheduleFixtures()) byId.set(f.fixtureId, f);

    if (hasTxlineToken()) {
      try {
        const snap = await getFixturesSnapshot();
        const rows = Array.isArray(snap)
          ? snap
          : Array.isArray((snap as { data?: unknown }).data)
            ? ((snap as { data: unknown[] }).data)
            : [];
        for (const raw of rows) {
          if (!raw || typeof raw !== 'object') continue;
          const mapped = mapTxlineFixture(raw as Record<string, unknown>);
          if (!mapped || !Number.isFinite(mapped.kickoffTs)) continue;
          // Prefer TxLINE names/state when present.
          byId.set(mapped.fixtureId, {
            ...mapped,
            status: statusFor(mapped.gameState, mapped.kickoffTs),
          });
        }
      } catch (e) {
        console.warn('[api/fixtures] TxLINE snapshot failed, using schedule', e);
      }
    }

    const now = Date.now();
    let mapped = Array.from(byId.values()).map((f) => ({
      ...f,
      status: statusFor(f.gameState, f.kickoffTs, now),
    }));

    // Drop ancient non-schedule noise outside match window interest.
    mapped = mapped.filter((f) => {
      if (WC_2026_SCHEDULE[f.fixtureId]) return true;
      return Math.abs(now - f.kickoffTs) < MATCH_WINDOW_MS * 4;
    });

    mapped.sort((a, b) => a.kickoffTs - b.kickoffTs);
    if (statusFilter) mapped = mapped.filter((f) => f.status === statusFilter);
    return NextResponse.json(mapped);
  } catch (e) {
    console.error('[api/fixtures]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'internal error' },
      { status: 500 },
    );
  }
}
