import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAnyAdmin } from '@/lib/api/adminAuth';
import { logAdminAction } from '@/lib/db/admin';
import { listIncidents, transitionIncident, updateIncidentMeta } from '@/lib/db/opsIncidents';
import type { Json } from '@/lib/supabase/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Incidents list (most recent first). `?active=1` hides resolved. */
export async function GET(req: NextRequest) {
  const auth = await requireAnyAdmin(req);
  if (!auth.ok) return auth.response;
  const activeOnly = req.nextUrl.searchParams.get('active') === '1';
  try {
    return NextResponse.json({ incidents: await listIncidents({ activeOnly }) });
  } catch (err) {
    return NextResponse.json({ error: 'list_failed', message: errMsg(err) }, { status: 500 });
  }
}

const Body = z
  .object({
    id: z.string().min(1),
    action: z.enum(['acknowledge', 'investigate', 'mitigate', 'resolve', 'reopen']).optional(),
    meta: z
      .object({
        owner: z.string().trim().max(120).nullable().optional(),
        runbookUrl: z.string().trim().max(500).nullable().optional(),
        postmortem: z.string().trim().max(8000).nullable().optional(),
        resolution: z.string().trim().max(2000).nullable().optional(),
        note: z.string().trim().max(2000).optional(),
      })
      .optional(),
  })
  .strict();

/** Drive an incident: a lifecycle `action` and/or `meta` (owner/notes/runbook/…). */
export async function POST(req: NextRequest) {
  const auth = await requireAnyAdmin(req);
  if (!auth.ok) return auth.response;

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (err) {
    return NextResponse.json({ error: 'invalid_body', message: errMsg(err) }, { status: 400 });
  }

  const actor = auth.ctx.username || auth.ctx.userId;
  try {
    let transition: { from: string; to: string } | null = null;
    if (body.action) transition = await transitionIncident({ id: body.id, action: body.action, actor, note: body.meta?.note });
    if (body.meta && (body.meta.owner !== undefined || body.meta.runbookUrl !== undefined || body.meta.postmortem !== undefined || body.meta.resolution !== undefined || (body.meta.note && !body.action))) {
      await updateIncidentMeta({ id: body.id, actor, ...body.meta });
    }
    await logAdminAction({
      ctx: auth.ctx,
      action: body.action ? `incident.${body.action}` : 'incident.update',
      targetType: 'ops_incident',
      targetId: body.id,
      reason: body.meta?.note ?? null,
      before: null,
      after: { transition, meta: body.meta ?? null } as unknown as Json,
      ip: auth.ip,
    });
    return NextResponse.json({ ok: true, transition });
  } catch (err) {
    const message = errMsg(err);
    const status = message.startsWith('invalid_transition') ? 409 : message === 'incident_not_found' ? 404 : 500;
    return NextResponse.json({ error: 'incident_action_failed', message }, { status });
  }
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : 'error';
}
