import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireSyncedUser } from '@/lib/ai/auth';
import { authorizeAdminRequest } from '@/lib/admin/authorize';
import { listExtLabels, setExtLabelHidden, approveExtLabel, deleteExtLabel } from '@/lib/ext/communityLabels';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Admin cockpit over the self-growing ext label pool (community / AI / X / admin). */
async function gate(req: NextRequest): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  const auth = await requireSyncedUser(req);
  if (!auth.ok) return { ok: false, response: auth.response };
  if (!authorizeAdminRequest(req, auth.user.wallet_address)) {
    return { ok: false, response: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) };
  }
  return { ok: true };
}

export async function GET(req: NextRequest) {
  const g = await gate(req);
  if (!g.ok) return g.response;
  const source = req.nextUrl.searchParams.get('source') || undefined;
  const statusParam = req.nextUrl.searchParams.get('status');
  const status = statusParam === 'live' || statusParam === 'queued' || statusParam === 'hidden' ? statusParam : undefined;
  const rows = await listExtLabels({ source, status });
  return NextResponse.json({ rows });
}

const ActionBody = z.object({ id: z.string().uuid(), action: z.enum(['hide', 'unhide', 'approve', 'delete']) }).strict();

export async function POST(req: NextRequest) {
  const g = await gate(req);
  if (!g.ok) return g.response;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad_json' }, { status: 400 });
  }
  const parsed = ActionBody.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  const { id, action } = parsed.data;
  try {
    if (action === 'hide') await setExtLabelHidden(id, true);
    else if (action === 'unhide') await setExtLabelHidden(id, false);
    else if (action === 'approve') await approveExtLabel(id);
    else await deleteExtLabel(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'action_failed' }, { status: 500 });
  }
}
