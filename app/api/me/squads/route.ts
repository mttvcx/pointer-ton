import { NextResponse, type NextRequest } from 'next/server';
import { requireSyncedUser } from '@/lib/ai/auth';
import { isMissingSquadsTable, listSquadsForUser } from '@/lib/db/squads';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/me/squads — squads the authed user is an active member of. */
export async function GET(req: NextRequest) {
  const auth = await requireSyncedUser(req);
  if (!auth.ok) return auth.response;
  try {
    const squads = await listSquadsForUser(auth.user.id);
    return NextResponse.json({ squads, provisioned: true });
  } catch (err) {
    if (isMissingSquadsTable(err)) {
      return NextResponse.json({ squads: [], provisioned: false });
    }
    const message = err instanceof Error ? err.message : 'me_squads_failed';
    return NextResponse.json({ error: 'me_squads_failed', message }, { status: 500 });
  }
}
