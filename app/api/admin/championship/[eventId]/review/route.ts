import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/api/adminAuth';
import { logAdminAction } from '@/lib/db/admin';
import { setParticipantReviewStatus, REVIEW_STATUSES } from '@/lib/db/championship';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z
  .object({
    participantId: z.string().uuid(),
    reviewStatus: z.enum(REVIEW_STATUSES as [string, ...string[]]),
    reason: z.string().trim().max(500).optional(),
  })
  .strict();

export async function POST(req: NextRequest, ctx: { params: Promise<{ eventId: string }> }) {
  const auth = await requireAdmin(req, 'championship.review');
  if (!auth.ok) return auth.response;

  const { eventId } = await ctx.params;
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (err) {
    const message = err instanceof Error ? err.message : 'invalid_body';
    return NextResponse.json({ error: 'invalid_body', message }, { status: 400 });
  }

  // Disqualification is sensitive -> require a reason.
  if (body.reviewStatus === 'disqualified' && (!body.reason || body.reason.length < 4)) {
    return NextResponse.json({ error: 'reason_required_for_disqualify' }, { status: 400 });
  }

  try {
    const updated = await setParticipantReviewStatus({
      participantId: body.participantId,
      reviewStatus: body.reviewStatus as never,
    });
    await logAdminAction({
      ctx: auth.ctx,
      action: 'championship.review.set',
      targetType: 'championship_participant',
      targetId: body.participantId,
      reason: body.reason ?? null,
      metadata: { eventId, reviewStatus: body.reviewStatus },
      ip: auth.ip,
    });
    return NextResponse.json({ participant: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'review_failed';
    return NextResponse.json({ error: 'review_failed', message }, { status: 500 });
  }
}
