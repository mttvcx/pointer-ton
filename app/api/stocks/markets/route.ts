import { NextResponse } from 'next/server';
import { fetchXStocksMarkets } from '@/lib/stocks/xstocksServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Live xStocks board data from Jupiter. Cached briefly in-process so the Pulse
// "Stocks" board doesn't hammer the token API on every client poll.
let cache: { at: number; markets: Awaited<ReturnType<typeof fetchXStocksMarkets>> } | null = null;
const TTL_MS = 30_000;

export async function GET() {
  try {
    if (!cache || Date.now() - cache.at > TTL_MS) {
      const markets = await fetchXStocksMarkets();
      // Keep the last good set if a refresh comes back empty (transient Jupiter blip).
      if (markets.length > 0 || !cache) cache = { at: Date.now(), markets };
      else cache = { at: Date.now(), markets: cache.markets };
    }
    return NextResponse.json({ markets: cache.markets, provider: 'xstocks' });
  } catch (err) {
    return NextResponse.json(
      { markets: [], provider: 'xstocks', error: err instanceof Error ? err.message : 'failed' },
      { status: 200 },
    );
  }
}
