import { NextResponse } from 'next/server';
import { getCachedJupiterTickerQuotes } from '@/lib/jupiter/tickerQuoteCache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const tickers = await getCachedJupiterTickerQuotes();
    return NextResponse.json(
      { tickers },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=45',
        },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'price_fetch_failed';
    return NextResponse.json({ error: message, tickers: [] }, { status: 502 });
  }
}
