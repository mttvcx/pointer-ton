import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/api/adminAuth';
import { logAdminAction } from '@/lib/db/admin';
import { grantCashback } from '@/lib/db/adminEconomy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z
  .object({
    targetUserId: z.string().uuid(),
    amountSol: z.number().refine((n) => n !== 0, 'amount cannot be zero').gte(-1000).lte(1000),
    reason: z.string().trim().min(8).max(500),
  })
  .strict();

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req, 'cashback.grant');
  if (!auth.ok) return auth.response;

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (err) {
    const message = err instanceof Error ? err.message : 'invalid_body';
    return NextResponse.json({ error: 'invalid_body', message }, { status: 400 });
  }

  try {
    const row = await grantCashback({
      userId: body.targetUserId,
      amountSol: body.amountSol,
      reason: body.reason,
      createdByUserId: auth.ctx.userId === 'system' ? null : auth.ctx.userId,
    });
    await logAdminAction({
      ctx: auth.ctx,
      action: 'cashback.grant',
      targetType: 'user',
      targetId: body.targetUserId,
      reason: body.reason,
      metadata: { amountSol: body.amountSol, ledgerId: row.id },
      ip: auth.ip,
    });
    return NextResponse.json({ entry: row });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'grant_failed';
    return NextResponse.json({ error: 'grant_failed', message }, { status: 500 });
  }
}
