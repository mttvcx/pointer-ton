import { NextResponse, type NextRequest } from 'next/server';
import { requireSyncedUser } from '@/lib/ai/auth';
import { getSquadDetail, isMissingSquadsTable } from '@/lib/db/squads';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/squads/[id] — squad detail + members. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireSyncedUser(req);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  try {
    const detail = await getSquadDetail(id, auth.user.id);
    if (!detail) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json(detail);
  } catch (err) {
    if (isMissingSquadsTable(err)) {
      return NextResponse.json({ error: 'not_provisioned', provisioned: false }, { status: 503 });
    }
    const message = err instanceof Error ? err.message : 'get_failed';
    return NextResponse.json({ error: 'get_failed', message }, { status: 500 });
  }
}
