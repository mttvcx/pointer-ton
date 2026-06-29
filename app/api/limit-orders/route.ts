import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import {
  insertLimitOrder,
  listLimitOrdersForUser,
} from '@/lib/db/limitOrders';
import { getUserByPrivyId } from '@/lib/db/users';
import { verifyPrivyAccessToken } from '@/lib/privy/config';
import { isValidPublicKey } from '@/lib/utils/addresses';
import { assertTradingAllowed, EmergencyBlockedError, emergencyBlockedResponse } from '@/lib/emergency/controls';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CreateSchema = z
  .object({
    mint: z.string().refine(isValidPublicKey),
    side: z.enum(['buy', 'sell']),
    trigger_price_usd: z.number().positive(),
    amount_sol: z.number().positive().optional(),
    amount_token_pct: z.number().min(0).max(100).optional(),
    slippage_bps: z.number().int().min(1).max(5000).optional(),
    expiry: z.enum(['1h', '4h', '24h', 'never']).default('24h'),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.side === 'buy' && (v.amount_sol == null || v.amount_sol <= 0)) {
      ctx.addIssue({ code: 'custom', message: 'amount_sol required for buy', path: ['amount_sol'] });
    }
    if (v.side === 'sell' && (v.amount_token_pct == null || v.amount_token_pct <= 0)) {
      ctx.addIssue({
        code: 'custom',
        message: 'amount_token_pct required for sell',
        path: ['amount_token_pct'],
      });
    }
  });

async function requireUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const accessToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length).trim()
    : null;
  if (!accessToken) return { error: NextResponse.json({ error: 'missing_authorization' }, { status: 401 }) };
  let verified;
  try {
    verified = await verifyPrivyAccessToken(accessToken);
  } catch {
    return { error: NextResponse.json({ error: 'invalid_token' }, { status: 401 }) };
  }
  const user = await getUserByPrivyId(verified.privyId);
  if (!user) {
    return {
      error: NextResponse.json(
        { error: 'user_not_synced', message: 'Call /api/auth/sync first' },
        { status: 403 },
      ),
    };
  }
  return { user };
}

function expiryToIso(expiry: z.infer<typeof CreateSchema>['expiry']): string | null {
  if (expiry === 'never') return null;
  const ms =
    expiry === '1h'
      ? 3_600_000
      : expiry === '4h'
        ? 14_400_000
        : 86_400_000;
  return new Date(Date.now() + ms).toISOString();
}

export async function GET(req: NextRequest) {
  const r = await requireUser(req);
  if ('error' in r) return r.error;
  const mint = req.nextUrl.searchParams.get('mint') ?? undefined;
  try {
    const orders = await listLimitOrdersForUser(r.user.id, { mint, status: undefined });
    return NextResponse.json({ orders });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const r = await requireUser(req);
  if ('error' in r) return r.error;
  // Emergency trading kill switch (limit orders are Solana trades). Fails closed.
  try {
    await assertTradingAllowed('sol');
  } catch (e) {
    if (e instanceof EmergencyBlockedError) return emergencyBlockedResponse(e);
    throw e;
  }
  let body: z.infer<typeof CreateSchema>;
  try {
    const json: unknown = await req.json();
    body = CreateSchema.parse(json);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'invalid_body';
    return NextResponse.json({ error: 'invalid_body', message }, { status: 400 });
  }
  try {
    const order = await insertLimitOrder({
      user_id: r.user.id,
      mint: body.mint,
      side: body.side,
      trigger_price_usd: body.trigger_price_usd,
      amount_sol: body.side === 'buy' ? body.amount_sol ?? null : null,
      amount_token_pct: body.side === 'sell' ? body.amount_token_pct ?? null : null,
      slippage_bps: body.slippage_bps ?? 500,
      status: 'open',
      expires_at: expiryToIso(body.expiry),
    });
    return NextResponse.json({ order });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
