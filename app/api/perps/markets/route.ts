import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getPerpMarkets } from '@/lib/hyperliquid/markets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const QuerySchema = z.object({
  coin: z.string().min(1).max(32).optional(),
});

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const parsed = QuerySchema.safeParse({ coin: url.searchParams.get('coin') ?? undefined });
    if (!parsed.success) {
      return NextResponse.json({ error: 'invalid_query' }, { status: 400 });
    }

    const markets = await getPerpMarkets();
    if (parsed.data.coin) {
      const coin = parsed.data.coin.toUpperCase();
      const one = markets.find((m) => m.coin === coin);
      if (!one) {
        return NextResponse.json({ error: 'market_not_found' }, { status: 404 });
      }
      return NextResponse.json(
        { market: one },
        { headers: { 'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=15' } },
      );
    }

    return NextResponse.json(
      { markets },
      { headers: { 'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=15' } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'hl_markets_failed';
    return NextResponse.json({ error: message, markets: [] }, { status: 502 });
  }
}
