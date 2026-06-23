import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Trivial liveness probe for the client connectivity indicator. No auth, no DB,
 * no external calls — just a fast round-trip so {@link useConnectionStatus} can
 * measure origin latency without recomputing the heavy /api/prices/tickers
 * payload (and without the `no-store` probe defeating that route's edge cache).
 */
export function GET() {
  return NextResponse.json({ ok: true }, { headers: { 'cache-control': 'no-store' } });
}
