import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Manual resolve needs the keeper's funded resolver wallet + TxLINE proof
 * pipeline. On Vercel we surface a clear message; run the keeper locally or
 * on Railway for settlement automation.
 */
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ pubkey: string }> | { pubkey: string } },
) {
  const { pubkey } = await Promise.resolve(ctx.params);
  return NextResponse.json(
    {
      ok: false,
      error:
        `Resolve for ${pubkey} requires the keeper service (ANCHOR_WALLET + TxLINE). ` +
        'Board/match data work on Vercel; run keeper for auto-settlement.',
    },
    { status: 503 },
  );
}
