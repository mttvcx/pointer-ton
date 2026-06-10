import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { EntityLocker } from '@/components/ai/EntityLocker';
import { TokenDetailView } from '@/components/tokens/TokenDetailView';
import { TokenHeader } from '@/components/tokens/TokenHeader';
import { getLatestSnapshotForMint } from '@/lib/db/tokens';
import { getDevWalletStats } from '@/lib/db/wallets';
import { cachedEnsureTokenRowFromDas } from '@/lib/helius/cachedEnsureTokenRow';
import { pulseTwitterProfileHoverTestBundle } from '@/lib/dev/demoPulseBundles';
import { demoFixturesEnabledServer } from '@/lib/dev/demoPolicy';
import { PULSE_X_HOVER_QA_MINT } from '@/lib/utils/solDemoMints';
import { isValidTokenMintParam } from '@/lib/chains/mintKind';
import { ensureTokenDexSnapshot } from '@/lib/market/ensureTokenDexSnapshot';
import { hydratePumpFunTokenRow, tokenNeedsPumpFunHydrate } from '@/lib/market/hydratePumpFunTokenRow';
import { resolveTokenSupplyUi } from '@/lib/tokens/supplyUi';

/** Compact USD market-cap label (e.g. "$121M" / "$1.4B" / "$640K"). */
function formatMcUsd(mc: number): string {
  if (!Number.isFinite(mc) || mc <= 0) return '';
  if (mc >= 1_000_000_000) return `$${(mc / 1_000_000_000).toFixed(1)}B`;
  if (mc >= 1_000_000) return `$${(mc / 1_000_000).toFixed(0)}M`;
  if (mc >= 1_000) return `$${(mc / 1_000).toFixed(0)}K`;
  return `$${mc.toFixed(0)}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ mint: string }>;
}): Promise<Metadata> {
  const { mint } = await params;
  const short = mint.length > 12 ? `${mint.slice(0, 4)}\u2026${mint.slice(-4)}` : mint;
  try {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[token-hydrate] metadata call', mint);
    }
    // Shared with page body via React cache() — one hydrate per request.
    const [token, snapshot] = await Promise.all([
      cachedEnsureTokenRowFromDas(mint),
      getLatestSnapshotForMint(mint),
    ]);
    if (process.env.NODE_ENV !== 'production') {
      console.log('[token-hydrate] metadata result', mint, {
        rowMint: token?.mint ?? null,
        symbol: token?.symbol ?? null,
      });
    }
    const symbol = (token?.symbol ?? '').trim() || short;
    const mcStr = formatMcUsd(Number(snapshot?.market_cap_usd ?? 0));
    const title = mcStr ? `${symbol} ${mcStr} | Pointer` : `${symbol} | Pointer`;
    return {
      title,
      description: `Trade ${symbol} on Pointer`,
    };
  } catch {
    return { title: `Token ${short} | Pointer` };
  }
}

export default async function TokenDetailPage({
  params,
}: {
  params: Promise<{ mint: string }>;
}) {
  const { mint } = await params;
  if (!isValidTokenMintParam(mint)) {
    notFound();
  }

  if (process.env.NODE_ENV !== 'production') {
    console.log('[token-hydrate] page call', mint);
  }
  let token = await cachedEnsureTokenRowFromDas(mint);
  if (token && tokenNeedsPumpFunHydrate(token, mint)) {
    token = await hydratePumpFunTokenRow(mint, token);
  }
  if (process.env.NODE_ENV !== 'production') {
    console.log('[token-hydrate] page result', mint, {
      rowMint: token?.mint ?? null,
      symbol: token?.symbol ?? null,
      creatorWallet: token?.creator_wallet ?? null,
      returnValue: token ? 'row' : 'null',
    });
  }
  if (!token) {
    notFound();
  }

  // Supply/LP hydrate is manual-only for pump RPC enrich; Dex snapshot runs on cold load.
  const [snapshotInitial, dev] = await Promise.all([
    ensureTokenDexSnapshot(mint, 'sol'),
    token.creator_wallet ? getDevWalletStats(token.creator_wallet) : Promise.resolve(null),
  ]);

  let snapshot = snapshotInitial ?? (await getLatestSnapshotForMint(mint));
  if (mint === PULSE_X_HOVER_QA_MINT && demoFixturesEnabledServer()) {
    snapshot = pulseTwitterProfileHoverTestBundle('sol')?.snapshot ?? snapshot;
  }
  const supplyTokens = resolveTokenSupplyUi(token.raw_metadata, token.decimals, {
    marketCapUsd: snapshot?.market_cap_usd,
    priceUsd: snapshot?.price_usd,
  });

  return (
    <>
      <EntityLocker type="token" id={mint} label={token.symbol ?? token.name ?? null} />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-transparent">
        {/* Scroll the header + chart away first; desk sticks and owns vertical scroll inside */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-auto bg-bg-raised [-ms-overflow-style:auto] [scrollbar-gutter:stable]">
          <div className="shrink-0 bg-bg-raised">
            <TokenHeader token={token} snapshot={snapshot} mint={mint} />
          </div>

          <Suspense
            fallback={<div className="min-h-[40vh] animate-pulse bg-bg-elevated/15" aria-hidden />}
          >
            <TokenDetailView
              mint={mint}
              symbol={token.symbol}
              tokenName={token.name}
              decimals={token.decimals}
              creatorWallet={token.creator_wallet}
              dev={dev}
              marketSnapshot={snapshot}
              supplyTokens={supplyTokens}
            />
          </Suspense>
        </div>
      </div>
    </>
  );
}
