import { NextResponse } from 'next/server';
import { listPublicPackConfigs } from '@/lib/packs/packConfig';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const { packs, snapshot, quote } = await listPublicPackConfigs();
  return NextResponse.json({
    packs,
    priceSnapshot: snapshot,
    solUsd: quote.solUsd,
    solUsdSource: quote.source,
  });
}
