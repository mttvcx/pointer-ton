import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { EntityLocker } from '@/components/ai/EntityLocker';
import { TokenDetailView } from '@/components/tokens/TokenDetailView';
import { TokenHeader } from '@/components/tokens/TokenHeader';
import { getLatestSnapshotForMint } from '@/lib/db/tokens';
import { getDevWalletStats } from '@/lib/db/wallets';
import { ensureTokenRowFromDas } from '@/lib/helius/feed';
import { isValidTokenMintParam } from '@/lib/chains/mintKind';
import { extractSupplyTokens } from '@/lib/tokens/metadataHints';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ mint: string }>;
}) {
  const { mint } = await params;
  const short = mint.length > 12 ? `${mint.slice(0, 4)}\u2026${mint.slice(-4)}` : mint;
  return {
    title: `Token ${short}`,
  };
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
      <div className="flex min-h-[calc(100dvh-var(--app-topbar-h)-var(--app-bottombar-h))] min-h-0 flex-1 flex-col overflow-hidden bg-bg-base">
        <div className="shrink-0">
          <TokenHeader token={token} snapshot={snapshot} mint={mint} />
        </div>

        <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <Suspense
              fallback={<div className="min-h-0 flex-1 animate-pulse bg-bg-elevated/15" aria-hidden />}
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
      </div>
    </>
  );
}
