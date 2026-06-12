import { NextResponse, type NextRequest } from 'next/server';
import { getLatestSnapshotForMint, getTokenByMint } from '@/lib/db/tokens';
import { resolveMintWalletStatsForDesk } from '@/lib/db/mintWalletStats';
import { isPointerQaMint } from '@/lib/qa/pointerQaMint';
import { canonicalSolAddress } from '@/lib/solana/canonicalAddress';
import { isValidPublicKey } from '@/lib/utils/addresses';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Per-wallet mint stats from chain indexer (`mint_wallet_stats`), with live fallback. */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ mint: string }> },
) {
  const { mint } = await ctx.params;
  const walletParam = req.nextUrl.searchParams.get('wallet')?.trim() ?? '';
  const wallet = canonicalSolAddress(walletParam) ?? walletParam;
  if (!isValidPublicKey(mint) || !isValidPublicKey(wallet)) {
    return NextResponse.json({ error: 'invalid_params' }, { status: 400 });
  }
  if (!isPointerQaMint(mint)) {
    return NextResponse.json({ stats: null, source: 'none' });
  }

  try {
    const [snapshot, token] = await Promise.all([
      getLatestSnapshotForMint(mint),
      getTokenByMint(mint),
    ]);
    const stats = await resolveMintWalletStatsForDesk(mint, wallet, {
      currentPriceUsd: snapshot?.price_usd ?? null,
      decimals: token?.decimals ?? 6,
    });
    return NextResponse.json({
      stats,
      source: stats ? 'chain_indexer' : 'none',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
