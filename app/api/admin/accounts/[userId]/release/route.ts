import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import {
  ACCOUNT_CONTROL_PERMISSION,
  ACCOUNT_RELEASE_AUDIT_ACTION,
} from '@/lib/admin/accountControlPolicy';
import { requireAdmin } from '@/lib/api/adminAuth';
import { logAdminAction } from '@/lib/db/admin';
import { releaseAccount } from '@/lib/db/accountControls';
import type { Json } from '@/lib/supabase/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z
  .object({
    reason: z.string().trim().min(8).max(500),
  })
  .strict();

/** Release an active freeze. Superadmin-only, reason required, audited. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ userId: string }> }) {
  const auth = await requireAdmin(req, ACCOUNT_CONTROL_PERMISSION);
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
    const control = await releaseAccount({
      targetUserId: userId,
      reason: body.reason,
      releasedByUserId: auth.ctx.userId === 'system' ? null : auth.ctx.userId,
    });
    if (!control) {
      return NextResponse.json({ error: 'no_active_freeze' }, { status: 409 });
    }
    await logAdminAction({
      ctx: auth.ctx,
      action: ACCOUNT_RELEASE_AUDIT_ACTION,
      targetType: 'user',
      targetId: userId,
      reason: body.reason,
      after: control as unknown as Json,
      ip: auth.ip,
    });
    return NextResponse.json({ control });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'release_failed';
    return NextResponse.json({ error: 'release_failed', message }, { status: 500 });
  }
}
