import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/api/adminAuth';
import { logAdminAction } from '@/lib/db/admin';
import { freezeAccount } from '@/lib/db/accountControls';
import type { Json } from '@/lib/supabase/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z
  .object({
    scope: z.enum(['all', 'trading', 'automation']).default('all'),
    reason: z.string().trim().min(8).max(500),
  })
  .strict();

/** Emergency FREEZE a user's trading/automation. Superadmin-only, reason required, audited. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ userId: string }> }) {
  const auth = await requireAdmin(req, 'account.control');
  if (!auth.ok) return auth.response;

  const { userId } = await ctx.params;
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (err) {
    const message = err instanceof Error ? err.message : 'invalid_body';
    return NextResponse.json({ error: 'invalid_body', message }, { status: 400 });
  }

  try {
    const control = await freezeAccount({
      targetUserId: userId,
      scope: body.scope,
      reason: body.reason,
      createdByUserId: auth.ctx.userId === 'system' ? null : auth.ctx.userId,
    });
    await logAdminAction({
      ctx: auth.ctx,
      action: 'account.freeze',
      targetType: 'user',
      targetId: userId,
      reason: body.reason,
      after: control as unknown as Json,
      metadata: { scope: body.scope },
      ip: auth.ip,
    });
    return NextResponse.json({ control });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'freeze_failed';
    return NextResponse.json({ error: 'freeze_failed', message }, { status: 500 });
  }
}
