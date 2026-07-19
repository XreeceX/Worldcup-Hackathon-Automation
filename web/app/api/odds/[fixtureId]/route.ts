import { NextResponse } from 'next/server';
import { condenseOddsSnapshot } from '@/lib/odds';
import { getOddsSnapshot, hasTxlineToken } from '@/lib/server/txline';
import { WC_2026_SCHEDULE } from '@/lib/wcSchedule';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ fixtureId: string }> | { fixtureId: string } },
) {
  try {
    if (!hasTxlineToken()) {
      return NextResponse.json({ error: 'TxLINE not configured' }, { status: 503 });
    }
    const { fixtureId: raw } = await Promise.resolve(ctx.params);
    const fixtureId = Number(raw);
    if (!Number.isFinite(fixtureId)) {
      return NextResponse.json({ error: 'fixtureId required' }, { status: 400 });
    }

    const condensed = condenseOddsSnapshot(await getOddsSnapshot(fixtureId));
    condensed.asOfKickoff = false;

    // The live snapshot can carry a partial book (e.g. 1X2 quoted but
    // over/under suspended). Backfill whichever market group is missing
    // from the as-of-kickoff snapshot so chips don't flicker away.
    const needs1x2 = condensed.homeWinPct == null;
    const needsOver = Object.keys(condensed.over).length === 0;
    const sched = WC_2026_SCHEDULE[fixtureId];
    if (sched && (needs1x2 || needsOver)) {
      const kickoff = Date.parse(sched.kickoffIso);
      const fallback = condenseOddsSnapshot(
        await getOddsSnapshot(fixtureId, kickoff - 5 * 60_000),
      );
      if (needs1x2 && fallback.homeWinPct != null) {
        condensed.homeWinPct = fallback.homeWinPct;
        condensed.drawPct = fallback.drawPct;
        condensed.awayWinPct = fallback.awayWinPct;
        condensed.asOfKickoff = true;
      }
      if (needsOver && Object.keys(fallback.over).length > 0) {
        condensed.over = fallback.over;
        condensed.asOfKickoff = true;
      }
      condensed.asOf ??= fallback.asOf;
    }

    return NextResponse.json(condensed);
  } catch (e) {
    console.error('[api/odds]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'error' },
      { status: 502 },
    );
  }
}
