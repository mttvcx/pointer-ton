import { NextResponse } from 'next/server';
import { z } from 'zod';
import { fetchPredictionMarkets } from '@/lib/predictions/fetchMarkets';
import type { PredictionDeskCategory, PredictionSort } from '@/lib/predictions/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const QuerySchema = z.object({
  deskCategory: z
    .enum(['Trending', 'All', 'Crypto', 'Sports', 'Politics', 'Watchlist'])
    .optional(),
  tag: z.string().max(64).optional(),
  q: z.string().max(120).optional(),
  sort: z.enum(['volume', 'liquidity', 'newest']).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const parsed = QuerySchema.safeParse({
      deskCategory: url.searchParams.get('deskCategory') ?? undefined,
      tag: url.searchParams.get('tag') ?? undefined,
      q: url.searchParams.get('q') ?? undefined,
      sort: url.searchParams.get('sort') ?? undefined,
      limit: url.searchParams.get('limit') ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json({ error: 'invalid_query' }, { status: 400 });
    }

    const payload = await fetchPredictionMarkets({
      deskCategory: (parsed.data.deskCategory ?? 'Trending') as PredictionDeskCategory,
      tag: parsed.data.tag ?? null,
      query: parsed.data.q ?? '',
      sort: (parsed.data.sort ?? 'volume') as PredictionSort,
      limit: parsed.data.limit,
    });

    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=45' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'predictions_markets_failed';
    return NextResponse.json({ error: message, markets: [], live: false, source: 'demo' }, { status: 502 });
  }
}
