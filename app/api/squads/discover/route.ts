import { NextResponse, type NextRequest } from 'next/server';
import { requireSyncedUser } from '@/lib/ai/auth';
import { isMissingSquadsTable, listDiscoverSquads } from '@/lib/db/squads';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/squads/discover — public / request-to-join squads (isMember flagged). */
export async function GET(req: NextRequest) {
  const auth = await requireSyncedUser(req);
  if (!auth.ok) return auth.response;
  try {
    const squads = await listDiscoverSquads(auth.user.id);
    return NextResponse.json({ squads, provisioned: true });
  } catch (err) {
    if (isMissingSquadsTable(err)) {
      return NextResponse.json({ squads: [], provisioned: false });
    }
    const message = err instanceof Error ? err.message : 'discover_failed';
    return NextResponse.json({ error: 'discover_failed', message }, { status: 500 });
  }
}
