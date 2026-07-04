import { NextResponse, type NextRequest } from 'next/server';
import { requireSyncedUser } from '@/lib/ai/auth';
import { isMissingSocialTable, unfollowTarget, type FollowTargetType } from '@/lib/db/socialGraph';
import { deleteTrackedWallet } from '@/lib/db/wallets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TYPES: FollowTargetType[] = ['user', 'wallet', 'twitter'];

/** POST /api/social/unfollow { targetType, targetRef } */
export async function POST(req: NextRequest) {
  const auth = await requireSyncedUser(req);
  if (!auth.ok) return auth.response;

  let body: { targetType?: string; targetRef?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const targetType = body.targetType as FollowTargetType;
  const targetRef = (body.targetRef ?? '').trim();
  if (!TYPES.includes(targetType) || !targetRef) {
    return NextResponse.json({ error: 'invalid_target' }, { status: 400 });
  }

  try {
    await unfollowTarget(auth.user.id, targetType, targetRef);
    if (targetType === 'wallet') {
      try {
        await deleteTrackedWallet(auth.user.id, targetRef);
      } catch {
        /* best-effort */
      }
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (isMissingSocialTable(err)) {
      return NextResponse.json({ error: 'not_provisioned', provisioned: false }, { status: 503 });
    }
    const message = err instanceof Error ? err.message : 'unfollow_failed';
    return NextResponse.json({ error: 'unfollow_failed', message }, { status: 500 });
  }
}
