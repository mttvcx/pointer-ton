import { NextResponse, type NextRequest } from 'next/server';
import { requireSyncedUser } from '@/lib/ai/auth';
import { isMissingSquadsTable, joinSquad } from '@/lib/db/squads';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/squads/[id]/join — join (public) or request (request_to_join). */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireSyncedUser(req);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  try {
    const result = await joinSquad(auth.user.id, id);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (isMissingSquadsTable(err)) {
      return NextResponse.json({ error: 'not_provisioned', provisioned: false }, { status: 503 });
    }
    const message = err instanceof Error ? err.message : 'join_failed';
    const status = message === 'join_not_allowed' ? 403 : message === 'squad_not_found' ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
