import { NextResponse } from 'next/server';
import { listPublicPackConfigs } from '@/lib/packs/packConfig';
import { liveCommerceActive } from '@/lib/packs/commerce';
import { getPacksTreasuryAddress } from '@/lib/packs/treasury';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const { packs, snapshot, quote } = await listPublicPackConfigs();
  const live = liveCommerceActive();
  return NextResponse.json({
    packs,
    priceSnapshot: snapshot,
    solUsd: quote.solUsd,
    solUsdSource: quote.source,
    // Commerce mode — drives the simulated/live banner and the pack-buy charge.
    live,
    treasury: live ? getPacksTreasuryAddress() : null,
  });
}
