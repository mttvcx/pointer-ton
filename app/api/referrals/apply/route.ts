import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requirePointerUser } from '@/lib/api/privyUser';
import { getReferralCodeRowByCode, normalizeReferralCode } from '@/lib/referrals/codes';
import {
  createReferralApply,
  getReferralByReferred,
  incrementReferralCodeUses,
} from '@/lib/referrals/earnings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BodySchema = z
  .object({
    code: z.string().min(1).max(32),
  })
  .strict();

export async function POST(req: NextRequest) {
  const r = await requirePointerUser(req);
  if ('error' in r) return r.error;

  let body: z.infer<typeof BodySchema>;
  try {
    const json: unknown = await req.json();
    body = BodySchema.parse(json);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'invalid_body';
    return NextResponse.json({ error: 'invalid_body', message }, { status: 400 });
  }

  const existing = await getReferralByReferred(r.user.id);
  if (existing) {
    return NextResponse.json({ error: 'already_referred' }, { status: 400 });
  }

  const norm = normalizeReferralCode(body.code);
  const codeRow = await getReferralCodeRowByCode(norm);
  if (!codeRow || !codeRow.is_active) {
    return NextResponse.json({ error: 'invalid_code' }, { status: 400 });
  }
  if (codeRow.user_id === r.user.id) {
    return NextResponse.json({ error: 'self_referral' }, { status: 400 });
  }

  try {
    await createReferralApply({
      referrerId: codeRow.user_id,
      referredId: r.user.id,
      code: codeRow.code,
    });
    await incrementReferralCodeUses(codeRow.code);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'apply_failed';
    const dup = message.includes('23505') || message.toLowerCase().includes('unique');
    return NextResponse.json(
      { error: dup ? 'already_referred' : 'apply_failed', message },
      { status: dup ? 400 : 500 },
    );
  }
}
