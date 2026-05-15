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
}: {
  mint: string;
  wallet: string;
  sym: string;
  /** When provided, dossier + filters use authoritative row stats for this mint. */
  topTraderRow?: MintTopTraderRow | null;
  rank?: number | null;
  creatorWallet?: string | null;
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
      className="text-xs text-fg-secondary hover:text-accent-primary"
    />
  );
}
