import { NextResponse, type NextRequest } from 'next/server';
import { fetchUsdPricesForMints } from '@/lib/jupiter/priceTickers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Spot USD for a Solana mint (Jupiter Price API). */
export async function GET(req: NextRequest) {
  const mint = req.nextUrl.searchParams.get('mint')?.trim();
  if (!mint) {
    return NextResponse.json({ error: 'missing_mint' }, { status: 400 });
  }
  try {
    const map = await fetchUsdPricesForMints([mint]);
    const row = map.get(mint);
    return NextResponse.json({
      usdPrice: row?.usdPrice ?? null,
      priceChange24h: row?.priceChange24h ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'price_failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
