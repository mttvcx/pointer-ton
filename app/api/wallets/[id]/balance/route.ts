import { NextResponse, type NextRequest } from 'next/server';
import { getUserByPrivyId } from '@/lib/db/users';
import { getUserWalletById, updateUserWalletBalance } from '@/lib/db/userWallets';
import { verifyPrivyAccessToken } from '@/lib/privy/config';
import { getSolBalanceLamports } from '@/lib/solana/recent-activity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
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
    return NextResponse.json({ error: 'user_not_synced' }, { status: 403 });
  }

  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: 'missing_id' }, { status: 400 });
  }

  const row = await getUserWalletById(user.id, id);
  if (!row) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  try {
    const lamports = await getSolBalanceLamports(row.wallet_address);
    const updated = await updateUserWalletBalance(user.id, id, lamports);
    return NextResponse.json({
      wallet_address: row.wallet_address,
      lamports: lamports.toString(),
      balance_updated_at: updated.balance_updated_at,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'balance_failed';
    return NextResponse.json({ error: 'balance_failed', message }, { status: 500 });
  }
}
