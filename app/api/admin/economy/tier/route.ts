import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/api/adminAuth';
import { logAdminAction } from '@/lib/db/admin';
import { listAllTiers } from '@/lib/db/tiers';
import { setUserTier } from '@/lib/db/adminEconomy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z
  .object({
    targetUserId: z.string().uuid(),
    tierId: z.string().min(1).max(64),
    reason: z.string().trim().min(8).max(500),
  })
  .strict();

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req, 'users.read');
  if (!auth.ok) return auth.response;
  try {
    const tiers = await listAllTiers();
    return NextResponse.json({ tiers });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'list_failed';
    return NextResponse.json({ error: 'list_failed', message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req, 'users.write');
  if (!auth.ok) return auth.response;

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (err) {
    const message = err instanceof Error ? err.message : 'invalid_body';
    return NextResponse.json({ error: 'invalid_body', message }, { status: 400 });
  }

  const tiers = await listAllTiers();
  if (!tiers.some((t) => t.id === body.tierId)) {
    return NextResponse.json({ error: 'unknown_tier' }, { status: 400 });
  }

  try {
    await setUserTier(body.targetUserId, body.tierId);
    await logAdminAction({
      ctx: auth.ctx,
      action: 'users.tier.assign',
      targetType: 'user',
      targetId: body.targetUserId,
      reason: body.reason,
      after: { tier_id: body.tierId },
      ip: auth.ip,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'assign_failed';
    return NextResponse.json({ error: 'assign_failed', message }, { status: 500 });
  }
}
