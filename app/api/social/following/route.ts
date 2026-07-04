import { NextResponse, type NextRequest } from 'next/server';
import { requireSyncedUser } from '@/lib/ai/auth';
import { followCounts, isMissingSocialTable, listFollowing } from '@/lib/db/socialGraph';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/social/following — everyone/-thing the authed user follows + counts. */
export async function GET(req: NextRequest) {
  const auth = await requireSyncedUser(req);
  if (!auth.ok) return auth.response;
  try {
    const [following, counts] = await Promise.all([
      listFollowing(auth.user.id),
      followCounts(auth.user.id),
    ]);
    return NextResponse.json({ following, counts });
  } catch (err) {
    if (isMissingSocialTable(err)) {
      return NextResponse.json({ following: [], counts: { following: 0, followers: 0 }, provisioned: false });
    }
    const message = err instanceof Error ? err.message : 'following_failed';
    return NextResponse.json({ error: 'following_failed', message }, { status: 500 });
  }
}
