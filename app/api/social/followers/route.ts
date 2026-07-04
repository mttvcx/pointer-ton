import { NextResponse, type NextRequest } from 'next/server';
import { requireSyncedUser } from '@/lib/ai/auth';
import { followCounts, isMissingSocialTable, listFollowers } from '@/lib/db/socialGraph';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/social/followers[?userId=…] — followers of a user (defaults to self),
 * plus counts for that user.
 */
export async function GET(req: NextRequest) {
  const auth = await requireSyncedUser(req);
  if (!auth.ok) return auth.response;
  const target = new URL(req.url).searchParams.get('userId') || auth.user.id;
  try {
    const [followers, counts] = await Promise.all([listFollowers(target), followCounts(target)]);
    return NextResponse.json({ followers, counts });
  } catch (err) {
    if (isMissingSocialTable(err)) {
      return NextResponse.json({ followers: [], counts: { following: 0, followers: 0 }, provisioned: false });
    }
    const message = err instanceof Error ? err.message : 'followers_failed';
    return NextResponse.json({ error: 'followers_failed', message }, { status: 500 });
  }
}
