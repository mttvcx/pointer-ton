import { fmtPerpUsdCompact } from '@/lib/hyperliquid/markets';
import type { PerpsL2Book } from '@/lib/perps/types';
import type { SyntheticStockMarket, SyntheticStockOrderbook } from '@/lib/stocks/types';
import { formatNumber } from '@/lib/utils/formatters';

export const STOCK_MAX_LEVERAGE = 20;

export function stockPriceDecimals(px: number): number {
  if (px >= 5000) return 0;
  if (px >= 500) return 1;
  if (px >= 1) return 2;
  return 4;
}

/** Demo oracle — slight premium to mark until live HIP-3 feed. */
export function stockOraclePx(market: SyntheticStockMarket): number {
  return market.priceUsd * 1.00015;
}

export function stockFundingHourly(market: SyntheticStockMarket): number {
  return (market.fundingRatePct ?? 0) / 100;
}

export function stockFundingApr(market: SyntheticStockMarket): number {
  return stockFundingHourly(market) * 24 * 365 * 100;
}

export function stockOrderbookToL2(
  ob: SyntheticStockOrderbook,
  mark: number,
): PerpsL2Book {
  const bids = ob.bids.map((l, i) => ({ px: l.price, sz: l.size, n: i + 1 }));
  const asks = ob.asks.map((l, i) => ({ px: l.price, sz: l.size, n: i + 1 }));
  const bestBid = bids[0]?.px ?? mark;
  const bestAsk = asks[0]?.px ?? mark;
  const mid = (bestBid + bestAsk) / 2;
  const spreadBps = mid > 0 ? ((bestAsk - bestBid) / mid) * 10000 : 0;
  return { coin: ob.symbol, bids, asks, spreadBps, mark };
}

export function formatStockFundingLabel(market: SyntheticStockMarket): {
  hourly: string;
  apr: string;
} {
  const hourly = stockFundingHourly(market);
  const apr = stockFundingApr(market);
  return {
    hourly: `${(hourly * 100).toFixed(4)}% / hr`,
    apr: `${apr >= 0 ? '+' : ''}${apr.toFixed(2)}% APR`,
  };
}

export function formatStockMark(market: SyntheticStockMarket): string {
  return formatNumber(market.priceUsd, { decimals: stockPriceDecimals(market.priceUsd) });
}

export function formatStockOi(market: SyntheticStockMarket): string {
  return market.openInterestUsd != null ? fmtPerpUsdCompact(market.openInterestUsd) : '—';
}

export function formatStockVol(market: SyntheticStockMarket): string {
  return fmtPerpUsdCompact(market.volume24hUsd);
}
