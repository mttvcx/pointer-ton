import { NextResponse, type NextRequest } from 'next/server';
import { requirePointerUser } from '@/lib/api/privyUser';
import { bridge } from '@/lib/financial/bridgeClient';
import { readFinancialAccount } from '@/lib/financial/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Is the Pointer Financial layer set up for this user, and what card do they hold.
 * `configured: false` = the provider isn't wired yet → the app uses its local
 * simulation. Never fabricates a funded account.
 */
export async function GET(req: NextRequest) {
  const auth = await requirePointerUser(req);
  if ('error' in auth) return auth.error;

  if (!bridge.configured()) {
    return NextResponse.json({ configured: false, status: 'unactivated', card: null });
  }

  const row = await readFinancialAccount(auth.user.id);
  if (!row?.bridge_card_id) {
    return NextResponse.json({ configured: true, status: 'unactivated', card: null });
  }

  const card = {
    last4: row.card_last4 ?? '••••',
    brand: 'Pointer',
    state: (row.card_state as 'virtual' | 'physical' | 'frozen') ?? 'virtual',
    monthlyLimit: 5000,
    kycTier: row.kyc_tier ?? 1,
    inWallet: !!row.card_in_wallet,
  };
  return NextResponse.json({ configured: true, status: 'active', card });
}
