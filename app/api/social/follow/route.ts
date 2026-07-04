import { NextResponse, type NextRequest } from 'next/server';
import { requireSyncedUser } from '@/lib/ai/auth';
import { followTarget, isMissingSocialTable, type FollowTargetType } from '@/lib/db/socialGraph';
import { upsertTrackedWallet } from '@/lib/db/wallets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TYPES: FollowTargetType[] = ['user', 'wallet', 'twitter'];

/**
 * POST /api/social/follow { targetType:'user'|'wallet'|'twitter', targetRef }
 * One-way follow. For wallet targets we also upsert tracked_wallets so the
 * trades feed lights up. The follow row IS the push subscription — when the
 * followed party trades, fan-out runs via notifyFollowersOf().
 */
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
    await followTarget(auth.user.id, targetType, targetRef);
    if (targetType === 'wallet') {
      try {
        await upsertTrackedWallet({ user_id: auth.user.id, wallet_address: targetRef, notify: true });
      } catch {
        /* best-effort — the follow row is authoritative */
      }
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (isMissingSocialTable(err)) {
      return NextResponse.json({ error: 'not_provisioned', provisioned: false }, { status: 503 });
    }
    const message = err instanceof Error ? err.message : 'follow_failed';
    return NextResponse.json({ error: 'follow_failed', message }, { status: 500 });
  }
}
