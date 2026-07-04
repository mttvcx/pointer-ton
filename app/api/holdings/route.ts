import { NextResponse, type NextRequest } from 'next/server';
import { getTopHoldingsForWallet, getTopHoldingsForWallets } from '@/lib/db/topHoldings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/holdings?address=<wallet>        → { credentials: TopHolderCredential[] }
 * GET /api/holdings?addresses=a,b,c         → { byWallet: Record<address, creds[]> }
 * Public read of the top-holder reverse index. Returns empty (not an error)
 * until the wallet_top_holdings table is provisioned + populated.
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const address = params.get('address')?.trim();
  const addresses = params.get('addresses');

  try {
    if (addresses) {
      const list = addresses.split(',').map((a) => a.trim()).filter(Boolean).slice(0, 60);
      const byWallet = await getTopHoldingsForWallets(list);
      return NextResponse.json({ byWallet });
    }
    if (!address) {
      return NextResponse.json({ error: 'missing_address' }, { status: 400 });
    }
    const credentials = await getTopHoldingsForWallet(address);
    return NextResponse.json({ credentials });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'holdings_failed';
    return NextResponse.json({ error: 'holdings_failed', message }, { status: 500 });
  }
}
