import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/api/adminAuth';
import { logAdminAction } from '@/lib/db/admin';
import { finalizeChampionshipEvent } from '@/lib/db/championship';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({ reason: z.string().trim().min(8).max(500) }).strict();

export async function POST(req: NextRequest, ctx: { params: Promise<{ eventId: string }> }) {
  const auth = await requireAdmin(req, 'championship.finalize');
  if (!auth.ok) return auth.response;

  const { eventId } = await ctx.params;
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (err) {
    const message = err instanceof Error ? err.message : 'invalid_body';
    return NextResponse.json({ error: 'invalid_body', message }, { status: 400 });
  }

  try {
    const { event, entries } = await finalizeChampionshipEvent({
      eventId,
      finalizedByUserId: auth.ctx.userId === 'system' ? null : auth.ctx.userId,
      reason: body.reason,
    });
    await logAdminAction({
      ctx: auth.ctx,
      action: 'championship.finalize',
      targetType: 'championship_event',
      targetId: eventId,
      reason: body.reason,
      metadata: { entries, finalizedAt: event.finalized_at },
      ip: auth.ip,
    });
    return NextResponse.json({ event, entries });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'finalize_failed';
    const status = message === 'already_finalized' ? 409 : message === 'event_not_found' ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
