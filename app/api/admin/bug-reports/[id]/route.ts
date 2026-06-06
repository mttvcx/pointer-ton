import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/api/adminAuth';
import { logAdminAction } from '@/lib/db/admin';
import { setBugReportStatus } from '@/lib/db/bugReports';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({ status: z.enum(['new', 'triaged', 'resolved', 'spam']) }).strict();

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req, 'bugreports.write');
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (err) {
    const message = err instanceof Error ? err.message : 'invalid_body';
    return NextResponse.json({ error: 'invalid_body', message }, { status: 400 });
  }

  try {
    const updated = await setBugReportStatus({
      id,
      status: body.status,
      triagedByUserId: auth.ctx.userId === 'system' ? null : auth.ctx.userId,
    });
    await logAdminAction({
      ctx: auth.ctx,
      action: 'bugreports.status',
      targetType: 'bug_report',
      targetId: id,
      metadata: { status: body.status },
      ip: auth.ip,
    });
    return NextResponse.json({ report: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'update_failed';
    return NextResponse.json({ error: 'update_failed', message }, { status: 500 });
  }
}
