import type { AppChainId } from '@/lib/chains/appChain';
import type { PnlSharePayload } from '@/lib/share/types';
import type { DeskWalletDisplayStats } from '@/lib/trading/deskWalletDisplayStats';

/** User has traded this mint on the desk (bought and/or sold). */
export function hasTokenDeskShareActivity(stats: DeskWalletDisplayStats): boolean {
  return stats.buyTon > 0 || stats.sellTon > 0;
}

export function buildTokenDeskSharePayload(params: {
  walletAddress: string;
  walletLabel?: string | null;
  mint: string;
  tokenTicker: string;
  tokenName?: string | null;
  tokenIconUrl?: string | null;
  chain: AppChainId;
  stats: DeskWalletDisplayStats;
}): PnlSharePayload {
  const { walletAddress, walletLabel, mint, tokenTicker, tokenName, tokenIconUrl, chain, stats } =
    params;

  return {
    walletAddress,
    walletLabel: walletLabel ?? null,
    tokenMint: mint,
    tokenTicker,
    tokenName: tokenName ?? null,
    tokenIconUrl: tokenIconUrl ?? null,
    chain,
    timeframe: '30d',
    pnlUsd: stats.netPnlUsd,
    pnlPct: stats.netPnlPct,
    investedUsd: stats.buyUsd,
    positionUsd: stats.holdingUsd,
    realizedUsd: null,
    unrealizedUsd: null,
    statInvestedLabel: 'Invested',
    statPositionLabel: 'Position',
  };
}
