import { NextResponse, type NextRequest } from 'next/server';
import { requireSyncedUser } from '@/lib/ai/auth';
import { isMissingSocialTable, sendFriendRequest } from '@/lib/db/socialGraph';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/social/friend-request { targetUserId }
 * Sends a request. If the target already asked us, this auto-accepts →
 * { status:'accepted' }; otherwise → { status:'pending' }.
 */
export async function POST(req: NextRequest) {
  const auth = await requireSyncedUser(req);
  if (!auth.ok) return auth.response;

  let body: { targetUserId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const targetUserId = (body.targetUserId ?? '').trim();
  if (!targetUserId) return NextResponse.json({ error: 'missing_target' }, { status: 400 });

  try {
    const result = await sendFriendRequest(auth.user.id, targetUserId);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (isMissingSocialTable(err)) {
      return NextResponse.json({ error: 'not_provisioned', provisioned: false }, { status: 503 });
    }
    const message = err instanceof Error ? err.message : 'friend_request_failed';
    const status = message === 'cannot_friend_self' ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
