import { NextResponse, type NextRequest } from 'next/server';
import { getTokenByMint } from '@/lib/db/tokens';
import { listMintWalletStatsByWallets } from '@/lib/db/mintWalletStats';
import { listMintSwapsForMint } from '@/lib/db/mintSwaps';
import { mintSwapToDeskTrade } from '@/lib/indexer/chainTradeAdapter';
import { dedupeMintSwapsForTradeDesk } from '@/lib/indexer/deskTradeSwaps';
import { classifyWalletForDesk } from '@/lib/onchain/walletDeskClassification';
import { resolveKnownPoolAddresses } from '@/lib/onchain/resolveKnownPoolAddresses';
import { resolveDeskWalletFundingBatch } from '@/lib/solana/deskWalletFunding';
import { isValidPublicKey } from '@/lib/utils/addresses';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Indexed chain swaps for any mint with mint_swaps rows. Returns 200 with an
 * empty array (label "indexer_pending") when no rows exist — the desk UI then
 * shows honest "indexer pending" copy instead of a 403.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ mint: string }> },
) {
  const { mint } = await ctx.params;
  if (!isValidPublicKey(mint)) {
    return NextResponse.json({ error: 'invalid_mint' }, { status: 400 });
  }

  const limit = Math.min(200, Math.max(1, Number(req.nextUrl.searchParams.get('limit')) || 80));
  try {
    const [rawSwaps, token] = await Promise.all([
      listMintSwapsForMint(mint, limit * 3),
      getTokenByMint(mint),
    ]);

    if (rawSwaps.length === 0) {
      return NextResponse.json({
        trades: [],
        source: 'chain_indexer',
        label: 'indexer_pending',
        message: 'No indexed chain trades yet for this mint.',
      });
    }

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
