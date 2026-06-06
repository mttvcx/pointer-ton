import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/api/adminAuth';
import { listSignerProvisionsForUser } from '@/lib/db/walletSignerProvisions';
import { listEmergencyActionsForUser } from '@/lib/db/emergencyActions';
import { getUserById } from '@/lib/db/users';
import { listUserWallets } from '@/lib/db/userWallets';
import { serverSignerConfigured } from '@/lib/privy/authorizationContext';
import { getServerWalletRescueStatus } from '@/lib/privy/serverWalletSign';
import { listNonZeroSplBalances } from '@/lib/solana/wallet-token-balances';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Rescue capabilities for a user — superadmin only, no user notification. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ userId: string }> }) {
  const auth = await requireAdmin(req, 'account.emergency_sell');
  if (!auth.ok) return auth.response;

  const { userId } = await ctx.params;
  try {
    const user = await getUserById(userId);
    if (!user) {
      return NextResponse.json({ error: 'user_not_found' }, { status: 404 });
    }

    const wallets = await listUserWallets(userId);
    const tradingWallets = wallets.filter((w) => !w.is_archived && !w.is_imported);

    const walletStatuses = await Promise.all(
      tradingWallets.map(async (w) => {
        const rescue = await getServerWalletRescueStatus(w.wallet_address);
        let tokenCount = 0;
        try {
          const bals = await listNonZeroSplBalances(w.wallet_address);
          tokenCount = bals.length;
        } catch {
          tokenCount = 0;
        }
        return {
          walletAddress: w.wallet_address,
          isPrimary: w.is_primary,
          rescue,
          splTokenCount: tokenCount,
        };
      }),
    );

    const [provisions, actions] = await Promise.all([
      listSignerProvisionsForUser(userId),
      listEmergencyActionsForUser(userId, 15),
    ]);

    return NextResponse.json({
      serverSignerConfigured: serverSignerConfigured(),
      privyUser: Boolean(user.privy_id),
      wallets: walletStatuses,
      provisions,
      recentActions: actions,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'rescue_status_failed';
    return NextResponse.json({ error: 'rescue_status_failed', message }, { status: 500 });
  }
}
