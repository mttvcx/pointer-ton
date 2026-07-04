import { NextResponse, type NextRequest } from 'next/server';
import { requireSyncedUser } from '@/lib/ai/auth';
import { isMissingSquadsTable, leaveSquad } from '@/lib/db/squads';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/squads/[id]/leave — soft-leave (status='left'). */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireSyncedUser(req);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  try {
    await leaveSquad(auth.user.id, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (isMissingSquadsTable(err)) {
      return NextResponse.json({ error: 'not_provisioned', provisioned: false }, { status: 503 });
    }
    const message = err instanceof Error ? err.message : 'leave_failed';
    return NextResponse.json({ error: 'leave_failed', message }, { status: 500 });
  }
}
