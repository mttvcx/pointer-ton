import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getPerpL2Book } from '@/lib/hyperliquid/markets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const QuerySchema = z.object({
  coin: z.string().min(1).max(32),
  mark: z.coerce.number().optional(),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    coin: url.searchParams.get('coin'),
    mark: url.searchParams.get('mark') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_query' }, { status: 400 });
  }

  try {
    const book = await getPerpL2Book(parsed.data.coin.toUpperCase(), parsed.data.mark);
    return NextResponse.json(
      { book },
      { headers: { 'Cache-Control': 'public, s-maxage=2, stale-while-revalidate=5' } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'hl_l2_failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
