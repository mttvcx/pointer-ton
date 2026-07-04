import { NextResponse, type NextRequest } from 'next/server';
import { requireSyncedUser } from '@/lib/ai/auth';
import { isMissingSocialTable, respondToFriendRequest } from '@/lib/db/socialGraph';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/social/friend-respond { requestId, accept:boolean } — addressee only. */
export async function POST(req: NextRequest) {
  const auth = await requireSyncedUser(req);
  if (!auth.ok) return auth.response;

  let body: { requestId?: string; accept?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const requestId = (body.requestId ?? '').trim();
  if (!requestId) return NextResponse.json({ error: 'missing_request' }, { status: 400 });

  try {
    const result = await respondToFriendRequest(auth.user.id, requestId, Boolean(body.accept));
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (isMissingSocialTable(err)) {
      return NextResponse.json({ error: 'not_provisioned', provisioned: false }, { status: 503 });
    }
    const message = err instanceof Error ? err.message : 'friend_respond_failed';
    const status = message === 'request_not_found' ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
