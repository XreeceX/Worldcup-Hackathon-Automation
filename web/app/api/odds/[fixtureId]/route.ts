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

    let rows = await getOddsSnapshot(fixtureId);
    let asOfKickoff = false;
    const empty =
      !Array.isArray(rows) ||
      rows.length === 0 ||
      (Array.isArray(rows) && rows.every((r) => !r));

    if (empty) {
      const sched = WC_2026_SCHEDULE[fixtureId];
      if (sched) {
        const kickoff = Date.parse(sched.kickoffIso);
        rows = await getOddsSnapshot(fixtureId, kickoff - 5 * 60_000);
        asOfKickoff = true;
      }
    }

    const condensed = condenseOddsSnapshot(rows);
    condensed.asOfKickoff = asOfKickoff;
    return NextResponse.json(condensed);
  } catch (e) {
    console.error('[api/odds]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'error' },
      { status: 502 },
    );
  }
}
