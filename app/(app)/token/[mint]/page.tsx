import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { EntityLocker } from '@/components/ai/EntityLocker';
import { TokenDetailView } from '@/components/tokens/TokenDetailView';
import { TokenHeader } from '@/components/tokens/TokenHeader';
import { getLatestSnapshotForMint } from '@/lib/db/tokens';
import { getDevWalletStats } from '@/lib/db/wallets';
import { ensureTokenRowFromDas } from '@/lib/helius/feed';
import { pulseTwitterProfileHoverTestBundle } from '@/lib/dev/demoPulseBundles';
import { demoFixturesEnabledServer } from '@/lib/dev/demoPolicy';
import { PULSE_X_HOVER_QA_MINT } from '@/lib/utils/solDemoMints';
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

  const [token, snapshotInitial] = await Promise.all([
    ensureTokenRowFromDas(mint),
    getLatestSnapshotForMint(mint),
  ]);
  if (!token) {
    notFound();
  }

  let snapshot = snapshotInitial;
  if (mint === PULSE_X_HOVER_QA_MINT && demoFixturesEnabledServer()) {
    snapshot = pulseTwitterProfileHoverTestBundle('sol')?.snapshot ?? snapshot;
  }
  const dev = token.creator_wallet
    ? await getDevWalletStats(token.creator_wallet)
    : null;
  const supplyTokens = extractSupplyTokens(token.raw_metadata);

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
