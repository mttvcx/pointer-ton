import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { insertAlert } from '@/lib/db/alerts';
import { APP_CHAIN_IDS } from '@/lib/chains/appChain';
import { getUserByPrivyId } from '@/lib/db/users';
import { verifyPrivyAccessToken } from '@/lib/privy/config';
import { ALERT_TYPE_USER_TRADE } from '@/lib/alerts/userActivityAlerts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UserTradePayloadSchema = z
  .object({
    kind: z.enum([
      'pulse_quick_buy',
      'pulse_quick_sell',
      'token_panel_buy',
      'token_panel_sell',
      'spot_buy',
      'spot_sell_pct',
      'spot_sell_sol_out',
    ]),
    mint: z.string().min(32).max(128),
    chain: z.enum(APP_CHAIN_IDS),
    amountSol: z.number().finite().nonnegative().optional(),
    sellPct: z.number().finite().positive().max(100).optional(),
    txSignature: z.string().nullable().optional(),
  })
  .strict();

const BodySchema = z
  .object({
    type: z.literal(ALERT_TYPE_USER_TRADE),
    narration: z.string().trim().min(1).max(500),
    payload: UserTradePayloadSchema,
  })
  .strict();

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const accessToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length).trim()
    : null;
  if (!accessToken) {
    return NextResponse.json({ error: 'missing_authorization' }, { status: 401 });
  }

  let verified;
  try {
    verified = await verifyPrivyAccessToken(accessToken);
  } catch {
    return NextResponse.json({ error: 'invalid_token' }, { status: 401 });
  }

  const user = await getUserByPrivyId(verified.privyId);
  if (!user) {
    return NextResponse.json(
      { error: 'user_not_synced', message: 'Call /api/auth/sync first' },
      { status: 403 },
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'validation_failed', issues: parsed.error.flatten() }, { status: 400 });
  }

  const { narration, payload } = parsed.data;

  const row = await insertAlert({
    user_id: user.id,
    type: ALERT_TYPE_USER_TRADE,
    ai_narration: narration,
    payload,
  });

  return NextResponse.json({ id: row.id });
}
