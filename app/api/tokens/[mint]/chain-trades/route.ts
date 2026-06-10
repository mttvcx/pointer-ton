import { NextResponse, type NextRequest } from 'next/server';
import { getTokenByMint } from '@/lib/db/tokens';
import { listMintWalletStatsByWallets } from '@/lib/db/mintWalletStats';
import { listMintSwapsForMint } from '@/lib/db/mintSwaps';
import { mintSwapToDeskTrade } from '@/lib/indexer/chainTradeAdapter';
import { dedupeMintSwapsForTradeDesk } from '@/lib/indexer/deskTradeSwaps';
import { classifyWalletForDesk } from '@/lib/onchain/walletDeskClassification';
import { resolveKnownPoolAddresses } from '@/lib/onchain/resolveKnownPoolAddresses';
import { resolveDeskWalletFundingBatch } from '@/lib/solana/deskWalletFunding';
import { isPointerQaMint } from '@/lib/qa/pointerQaMint';
import { isValidPublicKey } from '@/lib/utils/addresses';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Indexed chain swaps for QA mint desk tape. */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ mint: string }> },
) {
  const { mint } = await ctx.params;
  if (!isValidPublicKey(mint)) {
    return NextResponse.json({ error: 'invalid_mint' }, { status: 400 });
  }
  if (!isPointerQaMint(mint)) {
    return NextResponse.json({ error: 'qa_mint_only' }, { status: 403 });
  }

  const limit = Math.min(200, Math.max(1, Number(req.nextUrl.searchParams.get('limit')) || 80));
  try {
    const [rawSwaps, token] = await Promise.all([
      listMintSwapsForMint(mint, limit * 3),
      getTokenByMint(mint),
    ]);
    const swaps = dedupeMintSwapsForTradeDesk(rawSwaps).slice(0, limit);
    const wallets = [...new Set(swaps.map((s) => s.wallet).filter(Boolean))];
    const statsMap = await listMintWalletStatsByWallets(mint, wallets);

    const poolCtx = await resolveKnownPoolAddresses(mint);
    const humanWallets = wallets.filter((w) => !poolCtx.addresses.has(w));
    const fundingMap = await resolveDeskWalletFundingBatch(humanWallets, 2);
    const trades = swaps
      .map((row) => {
        const base = mintSwapToDeskTrade(row);
        if (!base) return null;
        const fund = fundingMap.get(row.wallet);
        const cls = classifyWalletForDesk({
          address: row.wallet,
          creatorWallet: token?.creator_wallet,
          poolRole: poolCtx.roles.get(row.wallet) ?? null,
          walletStats: statsMap.get(row.wallet) ?? null,
          tokenCreatedAt: token?.created_at,
          funding: fund?.funding ?? null,
          isFreshFunded: fund?.isFreshFunded ?? false,
        });
        return { ...base, desk_badges: cls.badges };
      })
      .filter((t): t is NonNullable<typeof t> => t != null);

    return NextResponse.json({
      trades,
      source: 'chain_indexer',
      label: 'Indexed chain trades',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
