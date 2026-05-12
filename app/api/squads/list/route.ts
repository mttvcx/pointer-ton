import { NextResponse, type NextRequest } from 'next/server';
import { requireSyncedUser } from '@/lib/ai/auth';
import { isMissingSquadsTable, listSquadsForUser } from '@/lib/db/squads';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/squads/list — squads the current user is in.
 *
 * Returns `{ squads: [], provisioned: false }` when the Phase 2 SQL
 * migration has not been applied yet, so the UI can render the
 * "Squads are coming soon — link your identity now" Phase 1 state
 * without any console noise.
 */
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
    const message = err instanceof Error ? err.message : 'list_failed';
    return NextResponse.json({ error: 'list_failed', message }, { status: 500 });
  }
}
