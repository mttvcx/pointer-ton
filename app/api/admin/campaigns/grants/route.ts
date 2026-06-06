import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/api/adminAuth';
import { logAdminAction } from '@/lib/db/admin';
import { issueGrant, listGrants, GRANT_TYPES } from '@/lib/db/adminCampaigns';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z
  .object({
    campaignId: z.string().uuid().nullable().optional(),
    targetUserId: z.string().uuid(),
    grantType: z.enum(GRANT_TYPES),
    amount: z.number().refine((n) => n !== 0, 'amount cannot be zero'),
    reason: z.string().trim().min(8).max(500),
  })
  .strict();

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req, 'campaigns.read');
  if (!auth.ok) return auth.response;
  const url = new URL(req.url);
  const campaignId = url.searchParams.get('campaignId') ?? undefined;
  try {
    const grants = await listGrants({ campaignId: campaignId ?? undefined });
    return NextResponse.json({ grants });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'list_failed';
    return NextResponse.json({ error: 'list_failed', message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req, 'campaigns.grant');
  if (!auth.ok) return auth.response;

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (err) {
    const message = err instanceof Error ? err.message : 'invalid_body';
    return NextResponse.json({ error: 'invalid_body', message }, { status: 400 });
  }

  // Points grants must be positive; cashback may be negative (debit).
  if (body.grantType === 'points' && body.amount <= 0) {
    return NextResponse.json({ error: 'points_amount_must_be_positive' }, { status: 400 });
  }

  try {
    const grant = await issueGrant({
      campaignId: body.campaignId ?? null,
      targetUserId: body.targetUserId,
      grantType: body.grantType,
      amount: body.amount,
      reason: body.reason,
      createdByUserId: auth.ctx.userId === 'system' ? null : auth.ctx.userId,
      grantedByLabel: auth.ctx.username || auth.ctx.walletAddress || auth.ctx.userId,
    });
    await logAdminAction({
      ctx: auth.ctx,
      action: 'campaigns.grant.issue',
      targetType: 'user',
      targetId: body.targetUserId,
      reason: body.reason,
      metadata: { grantId: grant.id, grantType: body.grantType, amount: body.amount, campaignId: body.campaignId ?? null },
      ip: auth.ip,
    });
    return NextResponse.json({ grant });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'grant_failed';
    return NextResponse.json({ error: 'grant_failed', message }, { status: 500 });
  }
}
