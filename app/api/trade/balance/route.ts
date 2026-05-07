import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { PublicKey } from '@solana/web3.js';
import { NextResponse, type NextRequest } from 'next/server';
import { getUserByPrivyId } from '@/lib/db/users';
import { userCanViewWalletPortfolio } from '@/lib/db/userWallets';
import { verifyPrivyAccessToken } from '@/lib/privy/config';
import { getConnection } from '@/lib/solana/connection';
import { isValidPublicKey } from '@/lib/utils/addresses';

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
  if (!mint || !isValidPublicKey(mint)) {
    return NextResponse.json({ error: 'invalid_mint' }, { status: 400 });
  }
  if (!wallet || !isValidPublicKey(wallet)) {
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
    const conn = getConnection();
    const owner = new PublicKey(wallet);
    const res = await conn.getParsedTokenAccountsByOwner(owner, {
      programId: TOKEN_PROGRAM_ID,
    });
    for (const { account } of res.value) {
      const parsed = account.data as unknown as {
        parsed?: { type?: string; info?: { mint?: string; tokenAmount?: { amount?: string } } };
      };
      const info = parsed.parsed?.info;
      if (info?.mint === mint && info?.tokenAmount?.amount != null) {
        return NextResponse.json({ mint, wallet, rawAmount: info.tokenAmount.amount });
      }
    }
    return NextResponse.json({ mint, wallet, rawAmount: '0' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'balance_failed';
    return NextResponse.json({ error: 'balance_failed', message }, { status: 500 });
  }
}
