import { NextResponse, type NextRequest } from 'next/server';
import { requirePointerUser } from '@/lib/api/privyUser';
import { lulo } from '@/lib/financial/luloClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Live Smart Yield rate (from Lulo). `configured: false` when no LULO_API_KEY →
 * the app shows its demo APY. Market rate only (no funds move, no signature); the
 * user's earned balance + deposits are a later step.
 */
export async function GET(req: NextRequest) {
  const auth = await requirePointerUser(req);
  if ('error' in auth) return auth.error;

  if (!lulo.configured()) {
    return NextResponse.json({ configured: false, apyPct: null });
  }

  try {
    const rates = await lulo.getRates();
    // Pointer's "Smart Yield" = the Protected (principal-protected) rate.
    const apyPct = rates.protectedApyPct ?? rates.boostApyPct ?? null;
    return NextResponse.json({ configured: true, apyPct, protectedApyPct: rates.protectedApyPct, boostApyPct: rates.boostApyPct });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'rates_failed';
    return NextResponse.json({ configured: true, apyPct: null, error: message }, { status: 502 });
  }
}
