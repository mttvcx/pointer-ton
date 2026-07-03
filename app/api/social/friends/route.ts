import { NextResponse, type NextRequest } from 'next/server';
import { requireSyncedUser } from '@/lib/ai/auth';
import { isMissingSocialTable, listFriends } from '@/lib/db/socialGraph';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/social/friends — accepted friends of the authed user. */
export async function GET(req: NextRequest) {
  const auth = await requireSyncedUser(req);
  if (!auth.ok) return auth.response;
  try {
    const friends = await listFriends(auth.user.id);
    return NextResponse.json({ friends });
  } catch (err) {
    if (isMissingSocialTable(err)) {
      return NextResponse.json({ friends: [], provisioned: false });
    }
    const message = err instanceof Error ? err.message : 'friends_failed';
    return NextResponse.json({ error: 'friends_failed', message }, { status: 500 });
  }
}
