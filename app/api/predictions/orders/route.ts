import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { kalshiConfigured, kalshiCreateOrder } from '@/lib/kalshi/client';
import { CreateOrderBodySchema } from '@/lib/kalshi/schemas';
import { assertTradingAllowed, EmergencyBlockedError, emergencyBlockedResponse } from '@/lib/emergency/controls';
import { verifyPrivyAccessToken } from '@/lib/privy/config';
import { getUserByPrivyId } from '@/lib/db/users';
import { accountFreezeGateOrNull } from '@/lib/trade/accountControlGate';
import { enforceTradeRateLimit } from '@/lib/rate-limit/userAction';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // Orders execute against Pointer's server-side house Kalshi account, so this
  // endpoint MUST be authenticated, attributed to a user, freeze-gated, and
  // rate-limited — otherwise anyone could spend house funds anonymously.
  const authHeader = req.headers.get('authorization');
  const accessToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length).trim()
    : null;
  if (!accessToken) {
    return NextResponse.json({ error: 'missing_authorization' }, { status: 401 });
  }
  let userId: string;
  try {
    const verified = await verifyPrivyAccessToken(accessToken);
    const user = await getUserByPrivyId(verified.privyId);
    if (!user) return NextResponse.json({ error: 'user_not_synced' }, { status: 403 });
    userId = user.id;
  } catch {
    return NextResponse.json({ error: 'invalid_token' }, { status: 401 });
  }

  // Per-user account freeze (fail-closed).
  const frozen = await accountFreezeGateOrNull(userId, 'trading');
  if (frozen) return frozen;

  // Per-user rate limit (house funds — never let a script hammer order entry).
  const rl = await enforceTradeRateLimit(userId);
  if (rl) return rl;

  if (!kalshiConfigured()) {
    return NextResponse.json(
      { error: 'kalshi_auth_missing', message: 'Kalshi API keys not configured on server.' },
      { status: 503 },
    );
  }
  // Emergency trading kill switch / maintenance / read-only — fails closed.
  try {
    await assertTradingAllowed();
  } catch (e) {
    if (e instanceof EmergencyBlockedError) return emergencyBlockedResponse(e);
    throw e;
  }

  try {
    const raw = await req.json();
    const body = CreateOrderBodySchema.parse(raw);
    const order = await kalshiCreateOrder(body);
    return NextResponse.json({ ok: true, order });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'invalid_body', details: err.flatten() }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : 'order_failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function GET() {
  return NextResponse.json({ configured: kalshiConfigured() });
}
