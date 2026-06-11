import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import type { AppChainId } from '@/lib/chains/appChain';
import { fetchMarketLighthouseSnapshot } from '@/lib/market/marketLighthouseAggregate';
import type { LighthouseTf } from '@/lib/market/marketLighthouseSnapshot';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const QuerySchema = z.object({
  chain: z.enum(['sol', 'eth', 'bnb', 'base', 'ton']).default('sol'),
  tf: z.enum(['5m', '1h', '6h', '24h']).default('1h'),
});

/** Chain-wide Pulse lighthouse stats from ingested token + DexScreener snapshots. */
export async function GET(req: NextRequest) {
  const parsed = QuerySchema.safeParse({
    chain: req.nextUrl.searchParams.get('chain') ?? undefined,
    tf: req.nextUrl.searchParams.get('tf') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_query' }, { status: 400 });
  }

  try {
    const snapshot = await fetchMarketLighthouseSnapshot(
      parsed.data.chain as AppChainId,
      parsed.data.tf as LighthouseTf,
    );
    return NextResponse.json(
      { snapshot },
      { headers: { 'Cache-Control': 'public, max-age=20, stale-while-revalidate=40' } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'lighthouse_failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
