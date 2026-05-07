import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getPresetsForUser, upsertPreset } from '@/lib/db/presets';
import { getUserByPrivyId } from '@/lib/db/users';
import { verifyPrivyAccessToken } from '@/lib/privy/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UpsertSchema = z
  .object({
    slot: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    name: z.string().min(1).max(40).optional(),
    buy_amounts_sol: z.array(z.number().positive()).min(1).max(8).optional(),
    slippage_bps: z.number().int().min(1).max(5000).optional(),
    dynamic_slippage: z.boolean().optional(),
    priority_fee_lamports: z.number().int().min(0).optional(),
    mev_mode: z.enum(['off', 'reduced', 'secure']).optional(),
    jito_tip_lamports: z.number().int().min(0).optional(),
    auto_fee: z.boolean().optional(),
    max_fee_sol: z.number().positive().optional(),
  })
  .strict();

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

export async function GET(req: NextRequest) {
  const r = await requireUser(req);
  if ('error' in r) return r.error;
  try {
    const presets = await getPresetsForUser(r.user.id);
    return NextResponse.json({ presets });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const r = await requireUser(req);
  if ('error' in r) return r.error;
  let body: z.infer<typeof UpsertSchema>;
  try {
    const json: unknown = await req.json();
    body = UpsertSchema.parse(json);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'invalid_body';
    return NextResponse.json({ error: 'invalid_body', message }, { status: 400 });
  }
  try {
    const preset = await upsertPreset(r.user.id, body.slot, body);
    return NextResponse.json({ preset });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
