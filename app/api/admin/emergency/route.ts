import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/api/adminAuth';
import { logAdminAction } from '@/lib/db/admin';
import { getControls, setControls, type EmergencyControls } from '@/lib/emergency/controls';
import type { Json } from '@/lib/supabase/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ChainPatch = z
  .object({
    sol: z.boolean().optional(),
    base: z.boolean().optional(),
    eth: z.boolean().optional(),
    bnb: z.boolean().optional(),
    ton: z.boolean().optional(),
  })
  .strict();

const Body = z
  .object({
    trading: z.boolean().optional(),
    ai: z.boolean().optional(),
    packs: z.boolean().optional(),
    cashback: z.boolean().optional(),
    referral: z.boolean().optional(),
    chains: ChainPatch.optional(),
    maintenance: z.boolean().optional(),
    readOnly: z.boolean().optional(),
    banner: z
      .union([
        z.object({ message: z.string().trim().min(1).max(280), level: z.enum(['info', 'warn', 'critical']) }).strict(),
        z.null(),
      ])
      .optional(),
    reason: z.string().trim().max(500).optional(),
  })
  .strict();

/** Current full control state (admin view). */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req, 'emergency.control');
  if (!auth.ok) return auth.response;
  try {
    return NextResponse.json({ controls: await getControls() });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'read_failed';
    return NextResponse.json({ error: 'read_failed', message }, { status: 500 });
  }
}

/** Apply a patch to the emergency controls. Every change is audit-logged and
 *  reversible (send the inverse). Persists to Redis → live within ~5s. */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req, 'emergency.control');
  if (!auth.ok) return auth.response;

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (err) {
    const message = err instanceof Error ? err.message : 'invalid_body';
    return NextResponse.json({ error: 'invalid_body', message }, { status: 400 });
  }

  const { reason, ...patch } = body;
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'empty_patch' }, { status: 400 });
  }

  let before: EmergencyControls | null = null;
  try {
    before = await getControls();
  } catch {
    /* controls store unreadable — audit `before` stays null */
  }

  const actor = auth.ctx.username || auth.ctx.userId;
  try {
    const after = await setControls(patch as Partial<EmergencyControls>, actor);
    await logAdminAction({
      ctx: auth.ctx,
      action: 'emergency.set',
      targetType: 'emergency_controls',
      targetId: 'global',
      reason: reason ?? null,
      before: (before ?? null) as unknown as Json,
      after: after as unknown as Json,
      metadata: { patch: patch as unknown as Record<string, unknown> },
      ip: auth.ip,
    });
    return NextResponse.json({ controls: after });
  } catch (err) {
    // Redis unreachable → the change did NOT take effect. Tell the admin clearly.
    const message = err instanceof Error ? err.message : 'set_failed';
    return NextResponse.json(
      { error: 'set_failed', message: 'Controls store unreachable — change NOT applied.', detail: message },
      { status: 503 },
    );
  }
}
