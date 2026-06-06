import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/api/adminAuth';
import { logAdminAction } from '@/lib/db/admin';
import { approveOverride, rejectOverride, getOverride } from '@/lib/db/packs';
import { canApproveOverride } from '@/lib/packs/overridePolicy';
import type { Json } from '@/lib/supabase/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ActionBody = z
  .object({
    action: z.enum(['approve', 'reject']),
    reason: z.string().trim().max(500).optional(),
  })
  .strict();

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  // Approve/reject is the high-value gate -> requires the approve permission.
  const auth = await requireAdmin(req, 'packs.override.approve');
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  let body: z.infer<typeof ActionBody>;
  try {
    body = ActionBody.parse(await req.json());
  } catch (err) {
    const message = err instanceof Error ? err.message : 'invalid_body';
    return NextResponse.json({ error: 'invalid_body', message }, { status: 400 });
  }

  const existing = await getOverride(id);
  if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  if (body.action === 'approve') {
    // Four-eyes principle: approver must be a real admin and differ from the
    // creator. The break-glass system actor can never approve.
    if (!canApproveOverride({ approverUserId: auth.ctx.userId, createdByUserId: existing.created_by })) {
      const reason = auth.ctx.userId === 'system' ? 'system_cannot_approve' : 'approver_must_differ_from_creator';
      return NextResponse.json({ error: reason }, { status: auth.ctx.userId === 'system' ? 403 : 409 });
    }
    try {
      const updated = await approveOverride(id, auth.ctx.userId);
      await logAdminAction({
        ctx: auth.ctx,
        action: 'packs.override.approve',
        targetType: 'pack_override',
        targetId: id,
        before: existing as unknown as Json,
        after: updated as unknown as Json,
        ip: auth.ip,
      });
      return NextResponse.json({ override: updated });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'approve_failed';
      return NextResponse.json({ error: 'approve_failed', message }, { status: 500 });
    }
  }

  // reject
  if (!body.reason || body.reason.length < 4) {
    return NextResponse.json({ error: 'reason_required' }, { status: 400 });
  }
  try {
    const updated = await rejectOverride(id, body.reason);
    await logAdminAction({
      ctx: auth.ctx,
      action: 'packs.override.reject',
      targetType: 'pack_override',
      targetId: id,
      reason: body.reason,
      before: existing as unknown as Json,
      after: updated as unknown as Json,
      ip: auth.ip,
    });
    return NextResponse.json({ override: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'reject_failed';
    return NextResponse.json({ error: 'reject_failed', message }, { status: 500 });
  }
}
