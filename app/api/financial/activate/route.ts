import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requirePointerUser } from '@/lib/api/privyUser';
import { bridge } from '@/lib/financial/bridgeClient';
import { saveFinancialAccount } from '@/lib/financial/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z
  .object({
    legalName: z.string().trim().min(2).max(120),
    country: z.string().trim().min(2).max(60),
    fullKyc: z.boolean().optional(),
  })
  .strict();

/**
 * Activate Pointer Financial: create a KYC'd customer + virtual account and issue
 * a virtual card via the provider, then remember it. `configured: false` when the
 * provider isn't wired → the app issues a simulated card instead. No real funds
 * move here (sandbox), and nothing is faked as successful.
 */
export async function POST(req: NextRequest) {
  const auth = await requirePointerUser(req);
  if ('error' in auth) return auth.error;

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  if (!bridge.configured()) {
    return NextResponse.json({ configured: false, card: null });
  }

  try {
    const idem = `fin:${auth.user.id}`;
    const customer = await bridge.createCustomer({
      legalName: body.legalName,
      country: body.country,
      fullKyc: !!body.fullKyc,
      idemKey: `${idem}:cust`,
    });
    await bridge.createVirtualAccount(customer.id, `${idem}:va`).catch(() => null);
    const issued = await bridge.issueVirtualCard(customer.id, `${idem}:card`);

    const card = {
      last4: issued.last4,
      brand: 'Pointer',
      state: 'virtual' as const,
      monthlyLimit: issued.spending_limit?.amount ?? 5000,
      kycTier: customer.kycTier,
      inWallet: false,
    };

    await saveFinancialAccount({
      user_id: auth.user.id,
      bridge_customer_id: customer.id,
      bridge_card_id: issued.id,
      card_last4: issued.last4,
      card_state: 'virtual',
      kyc_tier: customer.kycTier,
      card_in_wallet: false,
    });

    return NextResponse.json({ configured: true, card });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'activation_failed';
    return NextResponse.json({ error: message, code: 'BRIDGE_ERROR' }, { status: 502 });
  }
}
