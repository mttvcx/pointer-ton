import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requirePointerUser } from '@/lib/api/privyUser';
import { createCrossmintOrder, isCrossmintOrderConfigured, CrossmintOrderError } from '@/lib/crossmint/order';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Create a Crossmint order server-side so the app can render a native Apple Pay
 * sheet (fiat → token). Onramp orders can't be created client-side, so this is the
 * bridge: the app POSTs {chain, mint, amountUsd, recipient}, we mint an order with
 * the secret key and return {orderId, clientSecret}.
 *
 * `configured: false` (no key set) → the app keeps its honest "almost here" state.
 * Errors are mapped to a generic message so the provider is never surfaced.
 */
const Body = z.object({
  chain: z.enum(['sol', 'eth', 'base', 'bnb']).optional(),
  mint: z.string().min(1).max(128),
  amountUsd: z
    .union([z.string(), z.number()])
    .transform((v) => String(v))
    .refine((v) => Number(v) > 0 && Number(v) <= 10_000, 'amount_out_of_range'),
  recipient: z.string().min(1).max(128),
  email: z.string().email().optional().nullable(),
});

export async function POST(req: NextRequest) {
  const auth = await requirePointerUser(req);
  if ('error' in auth) return auth.error;

  if (!isCrossmintOrderConfigured()) {
    return NextResponse.json({ configured: false });
  }

  let parsed;
  try {
    parsed = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  try {
    const { orderId, clientSecret } = await createCrossmintOrder({
      chain: parsed.chain,
      mint: parsed.mint,
      amountUsd: parsed.amountUsd,
      recipientWallet: parsed.recipient,
      receiptEmail: parsed.email ?? auth.user.email ?? null,
    });
    return NextResponse.json({ configured: true, orderId, clientSecret });
  } catch (err) {
    const status = err instanceof CrossmintOrderError ? err.status : 502;
    return NextResponse.json({ error: 'order_failed' }, { status });
  }
}
