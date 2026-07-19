import { NextResponse } from 'next/server';
import { getScoresSnapshot } from '@/lib/server/txline';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ fixtureId: string }> | { fixtureId: string } },
) {
  try {
    const { fixtureId: raw } = await Promise.resolve(ctx.params);
    const fixtureId = Number(raw);
    if (!Number.isFinite(fixtureId)) {
      return NextResponse.json({ error: 'fixtureId is required' }, { status: 400 });
    }
    const data = await getScoresSnapshot(fixtureId);
    return NextResponse.json(data ?? {});
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error';
    if (msg.includes('TXLINE_API_TOKEN')) {
      return NextResponse.json({}, { status: 200 });
    }
    console.error('[api/scores/snapshot]', e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
