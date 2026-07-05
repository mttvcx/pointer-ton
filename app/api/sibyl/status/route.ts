import { NextResponse } from 'next/server';
import { providerStatuses } from '@/sibyl/data/providers';
import { sibylMockMode } from '@/sibyl/config';
import { PLANS } from '@/sibyl/pricing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/sibyl/status — what's live vs mock (surfaced in the dashboard footer). */
export function GET() {
  return NextResponse.json({
    mock: sibylMockMode(),
    providers: providerStatuses(),
    plans: Object.values(PLANS).map((p) => ({ tier: p.tier, label: p.label, price: p.priceUsdMonthly, maxMode: p.maxMode })),
  });
}
