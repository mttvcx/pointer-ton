import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { EntityLocker } from '@/components/ai/EntityLocker';
import { TokenDetailView } from '@/components/tokens/TokenDetailView';
import { TokenHeader } from '@/components/tokens/TokenHeader';
import { getLatestSnapshotForMint } from '@/lib/db/tokens';
import { getDevWalletStats } from '@/lib/db/wallets';
import { ensureTokenRowFromDas } from '@/lib/helius/feed';
import { isValidTokenMintParam } from '@/lib/chains/mintKind';
import { extractSupplyTokens } from '@/lib/tokens/metadataHints';

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
    // Reuse the same fetches the page itself runs; React/Next will dedupe.
    const [token, snapshot] = await Promise.all([
      ensureTokenRowFromDas(mint),
      getLatestSnapshotForMint(mint),
    ]);
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

  const token = await ensureTokenRowFromDas(mint);
  if (!token) {
    notFound();
  }

  const snapshot = await getLatestSnapshotForMint(mint);
  const dev = token.creator_wallet ? await getDevWalletStats(token.creator_wallet) : null;
  const supplyTokens = extractSupplyTokens(token.raw_metadata);

  return (
    <>
      <EntityLocker type="token" id={mint} label={token.symbol ?? token.name ?? null} />
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-transparent">
        <div className="shrink-0">
          <TokenHeader token={token} snapshot={snapshot} mint={mint} />
        </div>

        <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
          <Suspense
            fallback={<div className="min-h-0 flex-1 animate-pulse bg-bg-elevated/15" aria-hidden />}
          >
            <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overscroll-y-contain lg:overflow-hidden">
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
            </div>
          </Suspense>
        </div>
      </div>
    </>
  );
}
