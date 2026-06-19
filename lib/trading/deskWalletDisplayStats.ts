import { rawToUi } from '@/lib/utils/formatters';
import type { MintWalletStatsRow } from '@/lib/db/mintWalletStats';
import type { InstantTradeLifetimeStats } from '@/lib/trading/instantTradeStats';
import { balanceRawFromQueryData } from '@/lib/trading/tradeBalanceQuery';

export type DeskWalletDisplayStats = {
  buyTon: number;
  sellTon: number;
  holdingSol: number;
  /** Live wallet token balance (UI units) for the desk holding column. */
  holdingTokenUi: number;
  netPnlSol: number;
  netPnlPct: number | null;
  buyUsd: number;
  sellUsd: number;
  holdingUsd: number;
  netPnlUsd: number;
};

const EPS = 1e-9;

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
  } else if (!desk && tokenUi > 0 && buyUsd > 0) {
    // No desk row and no usable live price: mark the still-held position at cost
    // basis so an unsold holding shows ~break-even, not a false -100% total loss.
    holdingUsd = Math.max(0, buyUsd - sellUsd);
  }

  let holdingSol = 0;
  if (solUsdRate != null && solUsdRate > 0 && holdingUsd > 0) {
    holdingSol = holdingUsd / solUsdRate;
  } else {
    holdingSol = Math.max(0, buyTon - sellTon);
  }

  /** Axiom-style: proceeds (sells + current position mark) minus cost basis. */
  const liveNetPnlUsd = sellUsd + holdingUsd - buyUsd;

  let netPnlUsd: number;
  const hasLiveMark = priceUsd != null && priceUsd > 0 && tokenUi > EPS && buyUsd > EPS;
  if (hasLiveMark) {
    netPnlUsd = liveNetPnlUsd;
  } else if (desk) {
    const realized = desk.realized_pnl_usd ?? 0;
    const unrealized = desk.unrealized_pnl_usd ?? 0;
    netPnlUsd =
      unrealized != null && (realized !== 0 || unrealized !== 0)
        ? realized + unrealized
        : liveNetPnlUsd;
  } else {
    netPnlUsd = liveNetPnlUsd;
  }

  let netPnlSol: number;
  if (solUsdRate != null && solUsdRate > 0) {
    netPnlSol = netPnlUsd / solUsdRate;
  } else {
    netPnlSol = sellTon + holdingSol - buyTon;
  }

  const netPnlPct =
    buyUsd > EPS
      ? (netPnlUsd / buyUsd) * 100
      : buyTon > EPS
        ? (netPnlSol / buyTon) * 100
        : null;

  return {
    buyTon,
    sellTon,
    holdingSol,
    holdingTokenUi: tokenUi,
    netPnlSol,
    netPnlPct,
    buyUsd,
    sellUsd,
    holdingUsd,
    netPnlUsd,
  };
}
