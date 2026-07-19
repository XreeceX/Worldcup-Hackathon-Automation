import { NextResponse } from 'next/server';
import { fetchCommitmentBoard } from '@/lib/server/chain';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ pubkey: string }> | { pubkey: string } },
) {
  try {
    const params = await Promise.resolve(ctx.params);
    const row = await fetchCommitmentBoard(params.pubkey);
    if (!row) {
      return NextResponse.json({ error: 'not found' }, { status: 404 });
    }
    return NextResponse.json(row);
  } catch (e) {
    console.error('[api/commitment]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'internal error' },
      { status: 500 },
    );
  }
}
