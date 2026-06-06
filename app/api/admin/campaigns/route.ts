import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/api/adminAuth';
import { logAdminAction } from '@/lib/db/admin';
import { createCampaign, listCampaigns, GRANT_TYPES } from '@/lib/db/adminCampaigns';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z
  .object({
    name: z.string().trim().min(2).max(120),
    grantType: z.enum(GRANT_TYPES),
    reason: z.string().trim().max(500).optional(),
    startsAt: z.string().datetime().nullable().optional(),
    endsAt: z.string().datetime().nullable().optional(),
  })
  .strict();

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req, 'campaigns.read');
  if (!auth.ok) return auth.response;
  try {
    const campaigns = await listCampaigns();
    return NextResponse.json({ campaigns });
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

  try {
    const campaign = await createCampaign({
      name: body.name,
      grantType: body.grantType,
      reason: body.reason,
      startsAt: body.startsAt ?? null,
      endsAt: body.endsAt ?? null,
      createdByUserId: auth.ctx.userId === 'system' ? null : auth.ctx.userId,
    });
    await logAdminAction({
      ctx: auth.ctx,
      action: 'campaigns.create',
      targetType: 'campaign',
      targetId: campaign.id,
      reason: body.reason ?? null,
      metadata: { name: body.name, grantType: body.grantType },
      ip: auth.ip,
    });
    return NextResponse.json({ campaign });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'create_failed';
    return NextResponse.json({ error: 'create_failed', message }, { status: 500 });
  }
}
