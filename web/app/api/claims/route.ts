import { NextRequest, NextResponse } from 'next/server';
import { scanAllCommitments } from '@/lib/server/chain';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const wallet = req.nextUrl.searchParams.get('wallet');
    if (!wallet) {
      return NextResponse.json({ error: 'wallet query param required' }, { status: 400 });
    }

    const rows = await scanAllCommitments();
    const claims = [];
    for (const c of rows) {
      if (c.status !== 'Refunded' && c.status !== 'Void') continue;
      for (const m of c.members ?? []) {
        if (m.wallet !== wallet) continue;
        if (m.withdrawn || m.claimed) continue;
        claims.push({
          commitmentPubkey: c.pubkey,
          name: c.name,
          status: c.status,
          conditionLabel: c.conditionLabel,
          fixtureId: c.fixtureId,
          homeTeam: c.homeTeam ?? null,
          awayTeam: c.awayTeam ?? null,
          kickoffTs: c.kickoffTs,
          amountLamports: m.depositLamports,
          depositLamports: m.depositLamports,
          wallet,
        });
      }
    }
    return NextResponse.json(claims);
  } catch (e) {
    console.error('[api/claims]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'internal error' },
      { status: 500 },
    );
  }
}
