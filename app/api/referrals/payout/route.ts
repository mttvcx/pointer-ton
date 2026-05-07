import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { markReferralEarningsPaid } from '@/lib/referrals/payout';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BodySchema = z
  .object({
    earningIds: z.array(z.string().uuid()).min(1),
    paidOutTxSignature: z.string().min(32).max(200),
  })
  .strict();

function authorizeAdmin(req: NextRequest): boolean {
  const secret = process.env.POINTER_ADMIN_SECRET?.trim();
  if (!secret) {
    return process.env.NODE_ENV !== 'production';
  }
  const header = req.headers.get('x-pointer-admin-secret')?.trim();
  if (!header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Manual payout bookkeeping: marks referral_earning rows paid after an off-platform transfer.
 * // TODO Phase 3: automate via custom fee program
 */
export async function POST(req: NextRequest) {
  if (!authorizeAdmin(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const json: unknown = await req.json();
    const body = BodySchema.parse(json);
    await markReferralEarningsPaid({
      ids: body.earningIds,
      txSignature: body.paidOutTxSignature,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
