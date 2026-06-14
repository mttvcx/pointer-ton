import { NextResponse } from 'next/server';
import { getPredictionMarketDetail } from '@/lib/predictions/fetchMarkets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ ticker: string }> },
) {
  try {
    const { ticker } = await ctx.params;
    const id = decodeURIComponent(ticker);
    const detail = await getPredictionMarketDetail(id);
    if (!detail) {
      return NextResponse.json({ error: 'market_not_found' }, { status: 404 });
    }
    return NextResponse.json(
      { market: detail.market, outcomes: detail.outcomes },
      { headers: { 'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30' } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'market_failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
