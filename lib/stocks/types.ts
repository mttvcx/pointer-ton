/** Synthetic equity / pre-IPO perps — not real share ownership. */

export type SyntheticStockCategory = 'pre_ipo' | 'hot' | 'top';

export type SyntheticStockMarketType =
  | 'pre_ipo'
  | 'public_equity'
  | 'index'
  | 'crypto_equity';

export type SyntheticStockProviderId = 'mock' | 'tradexyz' | 'hyperliquid' | 'xstocks';

export interface SyntheticStockMarket {
  symbol: string;
  name: string;
  category: SyntheticStockCategory;
  marketType: SyntheticStockMarketType;
  priceUsd: number;
  change24hPct: number;
  volume24hUsd: number;
  /** Shown as MC on Pulse-style rows (demo notional cap). */
  marketCapUsd: number;
  openInterestUsd: number | null;
  fundingRatePct: number | null;
  liquidityUsd: number | null;
  /** Short AI blurb for hover / detail */
  aiSummary: string;
  watchlisted?: boolean;
  /** Solana SPL mint (xStocks) — lets the UI deep-link to the real /token/[mint]
   *  trade page so buys route through the existing Jupiter pipeline. */
  mint?: string;
  /** Official token logo (e.g. Backed xStocks metadata). */
  iconUrl?: string | null;
}

export interface SyntheticStockCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface SyntheticStockQuote {
  symbol: string;
  priceUsd: number;
  change24hPct: number;
  bid: number | null;
  ask: number | null;
  fundingRatePct: number | null;
  openInterestUsd: number | null;
  updatedAt: string;
}

export interface SyntheticStockOrderbookLevel {
  price: number;
  size: number;
}

export interface SyntheticStockOrderbook {
  symbol: string;
  bids: SyntheticStockOrderbookLevel[];
  asks: SyntheticStockOrderbookLevel[];
}

export interface SyntheticStockProvider {
  id: SyntheticStockProviderId;
  label: string;
  isLive: boolean;
  getMarkets(): Promise<SyntheticStockMarket[]>;
  getMarketBySymbol(symbol: string): Promise<SyntheticStockMarket | null>;
  getCandles(symbol: string, interval: string): Promise<SyntheticStockCandle[]>;
  getQuote(symbol: string): Promise<SyntheticStockQuote | null>;
  getOrderbook(symbol: string): Promise<SyntheticStockOrderbook | null>;
}

export const STOCK_CATEGORY_LABEL: Record<SyntheticStockCategory, string> = {
  pre_ipo: 'Pre-IPO',
  hot: 'Hot',
  top: 'Top',
};
