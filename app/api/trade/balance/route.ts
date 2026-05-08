import { NextResponse, type NextRequest } from 'next/server';
import { getUserByPrivyId } from '@/lib/db/users';
import { userCanViewWalletPortfolio } from '@/lib/db/userWallets';
import { verifyPrivyAccessToken } from '@/lib/privy/config';
import { fetchWalletJettonBalanceRaw } from '@/lib/ton/jettonWalletBalance';
import { normalizeTonAddress } from '@/lib/utils/tonAddress';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

  const mint = req.nextUrl.searchParams.get('mint');
  const wallet = req.nextUrl.searchParams.get('wallet');
  if (!mint || !normalizeTonAddress(mint)) {
    return NextResponse.json({ error: 'invalid_mint' }, { status: 400 });
  }
  if (!wallet || !normalizeTonAddress(wallet)) {
    return NextResponse.json({ error: 'invalid_wallet' }, { status: 400 });
  }

  const user = await getUserByPrivyId(verified.privyId);
  if (!user) {
    return NextResponse.json({ error: 'user_not_synced' }, { status: 403 });
  }

  const allowed = await userCanViewWalletPortfolio(user, wallet);
  if (!allowed) {
    return NextResponse.json({ error: 'wallet_not_allowed' }, { status: 403 });
  }

  try {
    const rawAmount = await fetchWalletJettonBalanceRaw({
      owner: wallet,
      jettonMaster: mint,
    });
    return NextResponse.json({ mint, wallet, rawAmount });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'balance_failed';
    return NextResponse.json({ error: 'balance_failed', message }, { status: 500 });
  }
}
