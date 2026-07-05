import { NextResponse } from 'next/server';
import { providerStatuses } from '@/sibyl/data/providers';
import { sibylForceMock, sibylMockMode } from '@/sibyl/config';
import { PLANS } from '@/sibyl/pricing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/sibyl/status — what's live vs mock (surfaced in the dashboard footer). */
export function GET() {
  const providers = providerStatuses();
  const modelMock = sibylMockMode();
  const forcedMock = sibylForceMock();
  const liveProviders = providers.filter((p) => p.configured).length;
  return NextResponse.json({
    // `mock` = fully offline (kept for back-compat). The real picture is the split below.
    mock: forcedMock,
    modelMock, // narrative/judge is deterministic (no LLM gateway key)
    forcedMock, // SIBYL_MOCK=1 hard-offline
    liveProviders, // how many DATA providers are real right now (e.g. Helius, DexScreener)
    providers,
    plans: Object.values(PLANS).map((p) => ({ tier: p.tier, label: p.label, price: p.priceUsdMonthly, maxMode: p.maxMode })),
  });
}
