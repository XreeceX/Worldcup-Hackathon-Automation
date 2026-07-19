import { NextResponse } from 'next/server';
import { hasTxlineToken } from '@/lib/server/txline';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    ok: true,
    mode: 'vercel-bff',
    txline: hasTxlineToken(),
  });
}
