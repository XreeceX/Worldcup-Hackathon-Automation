import { NextRequest, NextResponse } from 'next/server';
import { scanAllCommitments } from '@/lib/server/chain';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const status = searchParams.get('status') ?? undefined;
    const fixtureId = searchParams.get('fixture_id');
    const sort = searchParams.get('sort') ?? 'total_lamports';
    const limit = Math.min(Number(searchParams.get('limit') ?? 50), 200);
    const offset = Math.max(Number(searchParams.get('offset') ?? 0), 0);

    let rows = await scanAllCommitments();

    if (status) rows = rows.filter((r) => r.status === status);
    if (fixtureId != null && fixtureId !== '') {
      const id = Number(fixtureId);
      rows = rows.filter((r) => r.fixtureId === id);
    }

    if (sort === 'member_count') {
      rows.sort((a, b) => b.memberCount - a.memberCount);
    } else if (sort === 'created_at') {
      rows.sort((a, b) => b.kickoffTs - a.kickoffTs);
    } else {
      rows.sort((a, b) => b.totalLamports - a.totalLamports);
    }

    return NextResponse.json(rows.slice(offset, offset + limit));
  } catch (e) {
    console.error('[api/board]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'internal error' },
      { status: 500 },
    );
  }
}
