import { NextResponse } from 'next/server';
import { fetchJupiterTickerQuotes } from '@/lib/jupiter/priceTickers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const tickers = await fetchJupiterTickerQuotes();
    return NextResponse.json({ tickers });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'price_fetch_failed';
    return NextResponse.json({ error: message, tickers: [] }, { status: 502 });
  }
}
