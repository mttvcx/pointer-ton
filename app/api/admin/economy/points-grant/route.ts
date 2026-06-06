import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { requireAdmin } from '@/lib/api/adminAuth';
import { logAdminAction } from '@/lib/db/admin';
import { adminGrantPoints } from '@/lib/db/adminEconomy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z
  .object({
    targetUserId: z.string().uuid(),
    amount: z.number().positive().max(1_000_000),
    reason: z.string().trim().min(8).max(500),
  })
  .strict();

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req, 'points.grant');
  if (!auth.ok) return auth.response;

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (err) {
    const message = err instanceof Error ? err.message : 'invalid_body';
    return NextResponse.json({ error: 'invalid_body', message }, { status: 400 });
  }

  try {
    const dedupeKey = `admin_grant:${randomUUID()}`;
    await adminGrantPoints({
      userId: body.targetUserId,
      amount: body.amount,
      reason: body.reason,
      grantedByLabel: auth.ctx.username || auth.ctx.walletAddress || auth.ctx.userId,
      dedupeKey,
    });
    await logAdminAction({
      ctx: auth.ctx,
      action: 'points.grant',
      targetType: 'user',
      targetId: body.targetUserId,
      reason: body.reason,
      metadata: { amount: body.amount, dedupeKey },
      ip: auth.ip,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'grant_failed';
    return NextResponse.json({ error: 'grant_failed', message }, { status: 500 });
  }
}
