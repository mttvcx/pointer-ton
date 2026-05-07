import { NextResponse, type NextRequest } from 'next/server';
import { getTokenExtendedMetrics } from '@/lib/onchain/tokenMetrics';
import { isValidPublicKey } from '@/lib/utils/addresses';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ mint: string }> },
) {
  const { mint } = await ctx.params;
  if (!isValidPublicKey(mint)) {
    return NextResponse.json({ error: 'invalid_mint' }, { status: 400 });
  }
  try {
    const { metrics, token } = await getTokenExtendedMetrics(mint);
    return NextResponse.json({ metrics, symbol: token?.symbol ?? null });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
