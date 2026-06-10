import { NextResponse, type NextRequest } from 'next/server';
import { ensureTokenRowFromDas } from '@/lib/helius/feed';
import { listMintWalletStatsByWallets } from '@/lib/db/mintWalletStats';
import { buildDeskWalletClassifications } from '@/lib/indexer/deskWalletClassifications';
import { resolveKnownPoolAddresses } from '@/lib/onchain/resolveKnownPoolAddresses';
import { dedupeTokenHolderRows } from '@/lib/onchain/dedupeTokenHolders';
import { resolveTokenHolders } from '@/lib/onchain/resolveTokenHolders';
import { isValidTokenMintParam } from '@/lib/chains/mintKind';
import { isPointerQaMint } from '@/lib/qa/pointerQaMint';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ mint: string }> },
) {
  const { mint } = await ctx.params;
  if (!isValidTokenMintParam(mint)) {
    return NextResponse.json({ error: 'invalid_mint' }, { status: 400 });
  }

  const forceLive = req.nextUrl.searchParams.get('live') === '1';

  try {
    const token = await ensureTokenRowFromDas(mint);
    if (!token) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    const resolved = await resolveTokenHolders(mint, { limit: 20, forceLive });
    if (!resolved) {
      return NextResponse.json({ error: 'holders_unavailable' }, { status: 503 });
    }

    const holders = dedupeTokenHolderRows(resolved.holders);

    const walletStats =
      isPointerQaMint(mint)
        ? await listMintWalletStatsByWallets(
            mint,
            holders.map((h) => h.wallet_address),
          )
        : new Map();

    const [poolCtx, walletClassifications] = await Promise.all([
      resolveKnownPoolAddresses(mint),
      buildDeskWalletClassifications({
        mint,
        holders,
        walletStats,
        creatorWallet: token.creator_wallet,
        tokenCreatedAt: token.created_at,
      }),
    ]);

    const holdersEnriched = holders.map((h) => {
      const cls = walletClassifications[h.wallet_address];
      return {
        ...h,
        is_sniper: cls?.isSniper ?? h.is_sniper,
        is_dev: cls?.isDev ?? h.is_dev,
      };
    });

    return NextResponse.json({
      mint,
      decimals: resolved.decimals ?? token.decimals,
      holders: holdersEnriched,
      holderCount: resolved.holderCountTotal,
      holderCountTotal: resolved.holderCountTotal,
      holderRowsLoaded: resolved.holderRowsLoaded,
      top10HolderPct: resolved.top10HolderPctAdjusted ?? resolved.top10HolderPct,
      top10HolderPctRaw: resolved.top10HolderPctRaw,
      top10HolderPctAdjusted: resolved.top10HolderPctAdjusted,
      devHoldingPct: resolved.devHoldingPct,
      source: resolved.source,
      walletStats: Object.fromEntries(walletStats),
      walletClassifications,
      poolAddresses: [...poolCtx.addresses],
      indexerSource: isPointerQaMint(mint) ? 'chain_indexer' : null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'holders_failed';
    return NextResponse.json({ error: 'holders_failed', message }, { status: 500 });
  }
}
