import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/api/adminAuth';
import { logAdminAction } from '@/lib/db/admin';
import { markReferralEarningsPaid } from '@/lib/referrals/earnings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z
  .object({
    referrerId: z.string().uuid(),
    earningIds: z.array(z.string().uuid()).min(1).max(500),
    txSignature: z.string().trim().min(16).max(128),
    reason: z.string().trim().min(8).max(500),
  })
  .strict();

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req, 'referrals.payout');
  if (!auth.ok) return auth.response;

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (err) {
    const message = err instanceof Error ? err.message : 'invalid_body';
    return NextResponse.json({ error: 'invalid_body', message }, { status: 400 });
  }

  try {
    await markReferralEarningsPaid({ ids: body.earningIds, txSignature: body.txSignature });
    await logAdminAction({
      ctx: auth.ctx,
      action: 'referrals.payout',
      targetType: 'user',
      targetId: body.referrerId,
      reason: body.reason,
      metadata: { earningIds: body.earningIds, txSignature: body.txSignature, count: body.earningIds.length },
      ip: auth.ip,
    });
    return NextResponse.json({ ok: true, count: body.earningIds.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'payout_failed';
    return NextResponse.json({ error: 'payout_failed', message }, { status: 500 });
  }
}
