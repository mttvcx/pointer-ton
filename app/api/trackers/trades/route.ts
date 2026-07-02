import { NextResponse, type NextRequest } from 'next/server';
import { listTrackedWalletTradesForUser } from '@/lib/db/trackerTrades';
import { getUserByPrivyId } from '@/lib/db/users';
import { verifyPrivyAccessToken } from '@/lib/privy/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Live trades from THIS user's tracked wallets (real parsed swaps from mint_swaps). */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const accessToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length).trim()
    : null;
  if (!accessToken) {
    return NextResponse.json({ error: 'missing_authorization' }, { status: 401 });
  }

  let verified;
  try {
    verified = await verifyPrivyAccessToken(accessToken);
  } catch {
    return NextResponse.json({ error: 'invalid_token' }, { status: 401 });
  }

  const user = await getUserByPrivyId(verified.privyId);
  if (!user) {
    return NextResponse.json(
      { error: 'user_not_synced', message: 'Call /api/auth/sync first' },
      { status: 403 },
    );
  }

  const limitParam = req.nextUrl.searchParams.get('limit');
  const limit = Math.min(80, Math.max(1, limitParam ? Number(limitParam) || 40 : 40));

  try {
    const trades = await listTrackedWalletTradesForUser(user.id, limit);
    return NextResponse.json({ trades });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'trades_failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
