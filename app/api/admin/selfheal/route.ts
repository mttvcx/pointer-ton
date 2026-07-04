import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAdmin, requireAnyAdmin } from '@/lib/api/adminAuth';
import { logAdminAction } from '@/lib/db/admin';
import { executeHealAction, getSelfHealPlan } from '@/lib/ops/selfHeal';
import type { Json } from '@/lib/supabase/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The current self-heal plan (observe) — recommendations + escalations from
 *  Doctor's scored findings. Executes nothing. Any admin may view. */
export async function GET(req: NextRequest) {
  const auth = await requireAnyAdmin(req);
  if (!auth.ok) return auth.response;
  return NextResponse.json(await getSelfHealPlan());
}

const Body = z.object({ actionId: z.string().min(1).max(64) }).strict();

/** Manually run ONE safe repair action (human-approved). Dangerous actions are
 *  refused. Gated by emergency.control + audit-logged. */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req, 'emergency.control');
  if (!auth.ok) return auth.response;

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (err) {
    return NextResponse.json({ error: 'invalid_body', message: err instanceof Error ? err.message : 'bad' }, { status: 400 });
  }

  const actor = auth.ctx.username || auth.ctx.userId;
  const result = await executeHealAction(body.actionId, actor);
  await logAdminAction({
    ctx: auth.ctx,
    action: 'selfheal.run',
    targetType: 'heal_action',
    targetId: body.actionId,
    reason: null,
    before: null,
    after: result as unknown as Json,
    ip: auth.ip,
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
