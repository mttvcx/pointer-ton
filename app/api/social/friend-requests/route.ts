import { NextResponse, type NextRequest } from 'next/server';
import { requireSyncedUser } from '@/lib/ai/auth';
import { isMissingSocialTable, listPendingFriendRequests } from '@/lib/db/socialGraph';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/social/friend-requests — incoming pending requests for the authed user. */
export async function GET(req: NextRequest) {
  const auth = await requireSyncedUser(req);
  if (!auth.ok) return auth.response;
  try {
    const requests = await listPendingFriendRequests(auth.user.id);
    return NextResponse.json({ requests });
  } catch (err) {
    if (isMissingSocialTable(err)) {
      return NextResponse.json({ requests: [], provisioned: false });
    }
    const message = err instanceof Error ? err.message : 'friend_requests_failed';
    return NextResponse.json({ error: 'friend_requests_failed', message }, { status: 500 });
  }
}
