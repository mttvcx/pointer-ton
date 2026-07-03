import { NextResponse, type NextRequest } from 'next/server';
import { requirePointerUser } from '@/lib/api/privyUser';
import { bridge } from '@/lib/financial/bridgeClient';
import { readFinancialAccount } from '@/lib/financial/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Returns the issuer's Apple Pay push-provisioning payload for the user's card,
 * which the native PassKit add-to-wallet call consumes. `configured: false` or
 * `provisioning: null` when the provider/entitlement isn't in place yet.
 */
export async function POST(req: NextRequest) {
  const auth = await requirePointerUser(req);
  if ('error' in auth) return auth.error;

  if (!bridge.configured()) {
    return NextResponse.json({ configured: false, provisioning: null });
  }

  const row = await readFinancialAccount(auth.user.id);
  if (!row?.bridge_customer_id || !row?.bridge_card_id) {
    return NextResponse.json({ configured: true, provisioning: null, error: 'no_card' });
  }

  try {
    const provisioning = await bridge.applePayProvisioning(row.bridge_customer_id, row.bridge_card_id);
    return NextResponse.json({ configured: true, provisioning });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'provision_failed';
    return NextResponse.json({ configured: true, provisioning: null, error: message }, { status: 502 });
  }
}
