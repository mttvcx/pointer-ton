import { NextResponse, type NextRequest } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import { inferMintKind } from '@/lib/chains/mintKind';
import { getUserByPrivyId } from '@/lib/db/users';
import { userCanViewWalletPortfolio } from '@/lib/db/userWallets';
import { verifyPrivyAccessToken } from '@/lib/privy/config';
import { getConnection } from '@/lib/solana/connection';
import { heliusCall, HELIUS_CREDITS } from '@/lib/helius/creditLogger';
import { fetchWalletJettonBalanceRaw } from '@/lib/ton/jettonWalletBalance';
import { normalizeWalletAddressForStorage } from '@/lib/wallets/addressNormalize';
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
  if (!mint || !wallet) {
    return NextResponse.json({ error: 'invalid_params' }, { status: 400 });
  }

  const mintKind = inferMintKind(mint);
  const walletNorm = normalizeWalletAddressForStorage(wallet);
  if (!walletNorm || inferMintKind(walletNorm) !== mintKind) {
    return NextResponse.json({ error: 'chain_mismatch' }, { status: 400 });
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
    if (mintKind === 'ton') {
      const w = normalizeTonAddress(wallet);
      const m = normalizeTonAddress(mint);
      if (!w || !m) {
        return NextResponse.json({ error: 'invalid_ton_address' }, { status: 400 });
      }
      const rawAmount = await fetchWalletJettonBalanceRaw({
        owner: w,
        jettonMaster: m,
      });
      return NextResponse.json({ mint, wallet, rawAmount });
    }

    if (mintKind === 'sol') {
      const conn = getConnection();
      const mintPk = new PublicKey(mint.trim());
      const ownerPk = new PublicKey(wallet.trim());
      const ata = getAssociatedTokenAddressSync(mintPk, ownerPk);
      const bal = await heliusCall('getTokenAccountBalance', HELIUS_CREDITS.RPC, () =>
        conn.getTokenAccountBalance(ata),
      ).catch(() => null);
      const rawAmount = bal?.value?.amount ?? '0';
      return NextResponse.json({ mint: mintPk.toBase58(), wallet: ownerPk.toBase58(), rawAmount });
    }

    return NextResponse.json({ error: 'unsupported_chain' }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'balance_failed';
    return NextResponse.json({ error: 'balance_failed', message }, { status: 500 });
  }
}
