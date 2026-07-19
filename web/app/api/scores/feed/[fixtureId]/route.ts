import { NextResponse } from 'next/server';
import { getScoresHistorical, getScoresSnapshot } from '@/lib/server/txline';

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

    const byKey = new Map<string, Record<string, unknown>>();
    const ingest = (rows: unknown) => {
      const list = Array.isArray(rows)
        ? rows
        : rows && typeof rows === 'object'
          ? [rows]
          : [];
      for (const r of list) {
        if (!r || typeof r !== 'object') continue;
        const row = r as Record<string, unknown>;
        const key = `${row.Seq ?? row.seq ?? ''}:${row.Action ?? row.action ?? ''}:${row.Id ?? row.id ?? ''}`;
        byKey.set(key, row);
      }
    };

    try {
      ingest(await getScoresHistorical(fixtureId));
    } catch {
      /* optional */
    }
    try {
      ingest(await getScoresSnapshot(fixtureId));
    } catch {
      /* optional */
    }

    const out = Array.from(byKey.values()).sort(
      (a, b) => Number(a.Seq ?? a.seq ?? 0) - Number(b.Seq ?? b.seq ?? 0),
    );
    return NextResponse.json(out);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error';
    if (msg.includes('TXLINE_API_TOKEN')) {
      return NextResponse.json([]);
    }
    console.error('[api/scores/feed]', e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
