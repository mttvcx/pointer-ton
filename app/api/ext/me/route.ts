import { NextResponse, type NextRequest } from 'next/server';
import { requireExtAuth } from '@/lib/ext/auth';
import { getAiAccess } from '@/lib/access/aiAccess';
import { getUserById } from '@/lib/db/users';
import { getReferralCodeRowForUser } from '@/lib/referrals/codes';
import { resolveAdminContext } from '@/lib/db/admin';

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

  // Full access for ADMINS/founders (never paywall the operator). resolveAdminContext
  // also BOOTSTRAPS from ADMIN_BOOTSTRAP_EMAILS/WALLETS, so the founder is recognized
  // even if no admin row exists yet. EXT_TEST_UNLOCK=1 opens it for local testing.
  // Otherwise the SAME real gate as the app (≥5 SOL OR active subscription).
  const adminCtx = await resolveAdminContext(
    auth.userId,
    (user as { wallet_address?: string | null } | null)?.wallet_address ?? null,
    user?.username ?? null,
    user?.email ?? null,
  ).catch(() => null);
  const unlock = adminCtx != null || process.env.EXT_TEST_UNLOCK === '1';

  return NextResponse.json({
    connected: true,
    userId: auth.userId,
    email: user?.email ?? null,
    username: user?.username ?? null,
    subscription: unlock ? 'founder' : decision?.basis === 'subscription' ? 'active' : 'none',
    aiAccess: unlock ? true : (decision?.allowed ?? false),
    referralCode: refRow?.code ?? null,
    solBalance: null,
    monthlyVolumeSol: null,
    scansRemaining: unlock ? 999 : null,
  });
}
