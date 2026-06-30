import { NextResponse, type NextRequest } from 'next/server';
import { requireExtAuth } from '@/lib/ext/auth';
import { getAiAccess } from '@/lib/access/aiAccess';
import { getUserById } from '@/lib/db/users';
import { getReferralCodeRowForUser } from '@/lib/referrals/codes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Extension state sync — the popup's Account/Home data. Returns only what the
 * facade can VERIFY (never invented). AI access reuses the SAME gate as the app
 * (`getAiAccess`: ≥5 SOL OR active subscription). solBalance / monthlyVolume /
 * scansRemaining are the free-usage model — surfaced as the volume sync lands.
 */
export async function GET(req: NextRequest) {
  const auth = await requireExtAuth(req);
  if ('response' in auth) return auth.response;

  const [decision, user, refRow] = await Promise.all([
    getAiAccess(auth.userId).catch(() => null),
    getUserById(auth.userId).catch(() => null),
    getReferralCodeRowForUser(auth.userId).catch(() => null),
  ]);

  // TESTING UNBLOCK: when EXT_TEST_UNLOCK=1, the facade reports full access so
  // every gated surface (AI, premium, smart followers) is open — no payment
  // gating. Local-only flag; does NOT touch real subscriptions or money paths.
  const testUnlock = process.env.EXT_TEST_UNLOCK === '1';

  return NextResponse.json({
    connected: true,
    userId: auth.userId,
    email: user?.email ?? null,
    username: user?.username ?? null,
    subscription: testUnlock ? 'founder' : decision?.basis === 'subscription' ? 'active' : 'none',
    aiAccess: testUnlock ? true : (decision?.allowed ?? false),
    referralCode: refRow?.code ?? null,
    solBalance: null,
    monthlyVolumeSol: null,
    scansRemaining: testUnlock ? 999 : null,
  });
}
