'use client';

import { WalletIdentityAnchor } from '@/components/wallet/identity/WalletIdentityAnchor';
import type { MintTopTraderRow } from '@/lib/trading/mintTopTraders';

/**
 * Thin wrapper retained for callers — forwards into the unified wallet intelligence anchor.
 */
export function TopTraderWalletCell({
  mint,
  wallet,
  sym,
  topTraderRow,
  rank,
  creatorWallet,
  isDev,
  isSniper,
  onFilterMintTrades,
  tradesFilterActive,
}: {
  mint: string;
  wallet: string;
  sym: string;
  topTraderRow?: MintTopTraderRow | null;
  rank?: number | null;
  creatorWallet?: string | null;
  isDev?: boolean;
  isSniper?: boolean;
  onFilterMintTrades?: (address: string) => void;
  tradesFilterActive?: boolean;
}) {
  return (
    <WalletIdentityAnchor
      address={wallet}
      mint={mint}
      tokenSymbol={sym}
      href={`/wallet/${encodeURIComponent(wallet)}`}
      preferIntelModal
      truncate={5}
      topTraderRow={topTraderRow ?? null}
      rank={rank ?? null}
      creatorWallet={creatorWallet ?? null}
      isDev={isDev}
      isSniper={isSniper}
      showInlineBadges
      onFilterMintTrades={onFilterMintTrades}
      tradesFilterActive={tradesFilterActive}
      className="text-[12px] text-fg-secondary hover:text-accent-primary"
    />
  );
}
