import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/api/adminAuth';
import { logAdminAction } from '@/lib/db/admin';
import { createOverride, listOverrides, FORCED_OUTCOMES } from '@/lib/db/packs';
import type { Json } from '@/lib/supabase/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CreateBody = z
  .object({
    targetUserId: z.string().uuid(),
    packType: z.enum(['bronze', 'silver', 'gold', 'legendary']).nullable().optional().default(null),
    forcedOutcome: z.enum(FORCED_OUTCOMES),
    reason: z.string().trim().min(8).max(500),
    expiresAt: z
      .string()
      .datetime()
      .refine((s) => new Date(s).getTime() > Date.now(), 'expires_at must be in the future'),
  })
  .strict();

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req, 'packs.read');
  if (!auth.ok) return auth.response;
  const url = new URL(req.url);
  const status = url.searchParams.get('status') ?? undefined;
  try {
    const overrides = await listOverrides({ status: status ?? undefined });
    return NextResponse.json({ overrides });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'list_failed';
    return NextResponse.json({ error: 'list_failed', message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req, 'packs.override');
  if (!auth.ok) return auth.response;

  let body: z.infer<typeof CreateBody>;
  try {
    body = CreateBody.parse(await req.json());
  } catch (err) {
    const message = err instanceof Error ? err.message : 'invalid_body';
    return NextResponse.json({ error: 'invalid_body', message }, { status: 400 });
  }

  try {
    const override = await createOverride({
      targetUserId: body.targetUserId,
      packType: body.packType ?? null,
      forcedOutcome: body.forcedOutcome,
      reason: body.reason,
      expiresAt: body.expiresAt,
      createdByUserId: auth.ctx.userId === 'system' ? null : auth.ctx.userId,
    });
    await logAdminAction({
      ctx: auth.ctx,
      action: 'packs.override.create',
      targetType: 'pack_override',
      targetId: override.id,
      reason: body.reason,
      after: override as unknown as Json,
      metadata: { forcedOutcome: body.forcedOutcome, requiresApproval: override.requires_approval },
      ip: auth.ip,
    });
    return NextResponse.json({ override });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'create_failed';
    return NextResponse.json({ error: 'create_failed', message }, { status: 500 });
  }
}
