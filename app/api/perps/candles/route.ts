import { NextResponse, type NextRequest } from 'next/server';
import { fetchPerpCandles } from '@/lib/hyperliquid/candles';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/perps/candles?coin=BTC&tf=15m — Hyperliquid OHLC for the perps chart. */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const coin = (url.searchParams.get('coin') ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
  const tf = url.searchParams.get('tf') ?? '15m';
  if (!coin) return NextResponse.json({ error: 'coin_required', candles: [] }, { status: 400 });
  try {
    const candles = await fetchPerpCandles(coin, tf);
    return NextResponse.json({ candles });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'candles_failed';
    return NextResponse.json({ error: message, candles: [] }, { status: 502 });
  }
}
