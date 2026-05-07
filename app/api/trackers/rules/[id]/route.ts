import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireSyncedUser } from '@/lib/ai/auth';
import {
  deleteTrackerRule,
  getTrackerRuleForUser,
  updateTrackerRule,
} from '@/lib/db/trackerRules';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PatchBody = z
  .object({
    enabled: z.boolean(),
  })
  .strict();

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireSyncedUser(req);
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }

  let body: z.infer<typeof PatchBody>;
  try {
    body = PatchBody.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const existing = await getTrackerRuleForUser(auth.user.id, id);
  if (!existing) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  try {
    const row = await updateTrackerRule(auth.user.id, id, { enabled: body.enabled });
    return NextResponse.json({
      rule: {
        id: row.id,
        trackedWalletId: row.tracked_wallet_id,
        nlText: row.nl_text,
        condition: row.condition,
        summary: row.summary,
        enabled: row.enabled,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'update_failed';
    return NextResponse.json({ error: 'update_failed', message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireSyncedUser(req);
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }

  const existing = await getTrackerRuleForUser(auth.user.id, id);
  if (!existing) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  try {
    await deleteTrackerRule(auth.user.id, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'delete_failed';
    return NextResponse.json({ error: 'delete_failed', message }, { status: 500 });
  }
}
