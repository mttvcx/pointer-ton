import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getTokenChartBars } from '@/lib/helius/chart';
import { isValidTokenMintParam } from '@/lib/chains/mintKind';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const QuerySchema = z.object({
  interval: z
    .enum(['1s', '3m', '1m', '5m', '15m', '1h', '1d', '5d'])
    .default('5m'),
});

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ mint: string }> },
) {
  const { mint } = await ctx.params;
  if (!isValidTokenMintParam(mint)) {
    return NextResponse.json({ error: 'invalid_mint' }, { status: 400 });
  }

  const parsed = QuerySchema.safeParse({
    interval: req.nextUrl.searchParams.get('interval') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_query', issues: parsed.error.issues }, { status: 400 });
  }

  const interval = parsed.data.interval;
  try {
    const bars = await getTokenChartBars(mint, interval);
    return NextResponse.json({ mint, interval, bars });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'chart_failed';
    return NextResponse.json({ error: 'chart_failed', message }, { status: 500 });
  }
}
