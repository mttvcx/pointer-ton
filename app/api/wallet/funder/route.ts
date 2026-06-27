import { NextResponse, type NextRequest } from 'next/server';
import { resolveFunderWallet } from '@/lib/helius/funder';

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/**
 * GET /api/wallet/funder?wallet=<creator>
 * Returns the wallet that first funded `wallet` (for the funding-wallet blacklist).
 * Result is immutable, so it's cached hard at the edge to keep Helius credits low.
 */
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet')?.trim() ?? '';
  if (!BASE58.test(wallet)) {
    return NextResponse.json({ error: 'invalid wallet' }, { status: 400 });
  }
  try {
    const funder = await resolveFunderWallet(wallet);
    return NextResponse.json(
      { wallet, funder },
      { headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800' } },
    );
  } catch (e) {
    // Never throw to the client — funder resolution is best-effort.
    return NextResponse.json({ wallet, funder: null, error: e instanceof Error ? e.message : 'failed' });
  }
}
