import { rawToUi } from '@/lib/utils/formatters';
import type { MintWalletStatsRow } from '@/lib/db/mintWalletStats';
import type { InstantTradeLifetimeStats } from '@/lib/trading/instantTradeStats';
import { balanceRawFromQueryData } from '@/lib/trading/tradeBalanceQuery';

export type DeskWalletDisplayStats = {
  buyTon: number;
  sellTon: number;
  holdingSol: number;
  netPnlSol: number;
  netPnlPct: number | null;
  buyUsd: number;
  sellUsd: number;
  holdingUsd: number;
  netPnlUsd: number;
};

/** Merge localStorage session stats with chain-indexed `mint_wallet_stats`. */
export function computeDeskWalletDisplayStats(params: {
  session: InstantTradeLifetimeStats;
  desk: MintWalletStatsRow | null | undefined;
  solUsdRate: number | null;
  priceUsd?: number | null;
  balanceRaw?: unknown;
  decimals?: number;
}): DeskWalletDisplayStats {
  const { session, desk, solUsdRate, priceUsd, balanceRaw, decimals } = params;

  const buyTon =
    desk?.buy_sol != null ? Math.max(session.buyTon, desk.buy_sol) : session.buyTon;
  const sellTon =
    desk?.sell_sol != null ? Math.max(session.sellTon, desk.sell_sol) : session.sellTon;

  const buyUsd =
    desk?.buy_usd != null && desk.buy_usd > 0
      ? Math.max(session.buyTon * (solUsdRate ?? 0), desk.buy_usd)
      : buyTon * (solUsdRate ?? 0);
  const sellUsd =
    desk?.sell_usd != null && desk.sell_usd > 0
      ? Math.max(session.sellTon * (solUsdRate ?? 0), desk.sell_usd)
      : sellTon * (solUsdRate ?? 0);

  const rawStr = balanceRawFromQueryData(balanceRaw);
  let tokenUi = desk?.remaining_token_ui ?? 0;
  if (rawStr !== '0' && decimals != null) {
    const liveUi = rawToUi(rawStr, decimals);
    if (liveUi > tokenUi) tokenUi = liveUi;
  }

  let holdingUsd = 0;
  if (priceUsd != null && priceUsd > 0 && tokenUi > 0) {
    holdingUsd = tokenUi * priceUsd;
  } else if (desk?.remaining_token_ui && desk.avg_buy_usd) {
    holdingUsd = desk.remaining_token_ui * desk.avg_buy_usd;
  }

  let holdingSol = Math.max(0, buyTon - sellTon);
  if (solUsdRate != null && solUsdRate > 0 && holdingUsd > 0) {
    holdingSol = holdingUsd / solUsdRate;
  }

  let netPnlUsd = sellUsd - buyUsd;
  if (desk) {
    const realized = desk.realized_pnl_usd ?? 0;
    const unrealized = desk.unrealized_pnl_usd ?? 0;
    netPnlUsd = realized + (unrealized ?? 0);
  }

  let netPnlSol = sellTon - buyTon;
  if (solUsdRate != null && solUsdRate > 0) {
    netPnlSol = netPnlUsd / solUsdRate;
  }

  const netPnlPct = buyUsd > 0 ? (netPnlUsd / buyUsd) * 100 : buyTon > 0 ? (netPnlSol / buyTon) * 100 : null;

  return {
    buyTon,
    sellTon,
    holdingSol,
    netPnlSol,
    netPnlPct,
    buyUsd,
    sellUsd,
    holdingUsd,
    netPnlUsd,
  };
}
