import { NextResponse, type NextRequest } from 'next/server';
import { listTradesForMint } from '@/lib/db/trades';
import { isValidPublicKey } from '@/lib/utils/addresses';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ mint: string }> },
) {
  const { mint } = await ctx.params;
  if (!isValidPublicKey(mint)) {
    return NextResponse.json({ error: 'invalid_mint' }, { status: 400 });
  }
  const limit = Math.min(200, Math.max(1, Number(req.nextUrl.searchParams.get('limit')) || 80));
  try {
    const trades = await listTradesForMint(mint, limit);
    return NextResponse.json({ trades });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
