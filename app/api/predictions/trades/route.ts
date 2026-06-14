import { NextResponse } from 'next/server';
import { z } from 'zod';
import { kalshiGetTrades } from '@/lib/kalshi/client';
import { mapKalshiTrade } from '@/lib/kalshi/mapMarket';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const QuerySchema = z.object({
  ticker: z.string().min(1).max(128).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const parsed = QuerySchema.safeParse({
      ticker: url.searchParams.get('ticker') ?? undefined,
      limit: url.searchParams.get('limit') ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json({ error: 'invalid_query' }, { status: 400 });
    }

    const res = await kalshiGetTrades({
      ticker: parsed.data.ticker,
      limit: parsed.data.limit ?? 50,
    });

    return NextResponse.json(
      { trades: res.trades.map(mapKalshiTrade) },
      { headers: { 'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=15' } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'trades_failed';
    return NextResponse.json({ error: message, trades: [] }, { status: 502 });
  }
}
