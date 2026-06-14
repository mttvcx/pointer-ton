export type PredictionCategory =
  | 'Crypto'
  | 'Macro'
  | 'Politics'
  | 'AI'
  | 'Stocks'
  | 'Sports'
  | 'ETFs';

export type PredictionTrend = 'up' | 'down' | 'flat';

export type PredictionDeskCategory =
  | 'Trending'
  | 'All'
  | 'Crypto'
  | 'Sports'
  | 'Politics'
  | 'Watchlist';

export type PredictionSort = 'volume' | 'liquidity' | 'newest';

export type PredictionView = 'table' | 'cards';

export type PredictionAlphaItem = {
  id: string;
  title: string;
  url: string;
  source: string;
  ago: string;
  kind: 'youtube' | 'blog' | 'news' | 'analysis';
};

export interface PredictionMarket {
  id: string;
  /** Kalshi market ticker when live. */
  ticker?: string;
  eventTicker?: string;
  title: string;
  outcomeLabel: string;
  yesPct: number;
  yesPriceCents: number;
  noPriceCents: number;
  changePct24h: number;
  /** Cent change for flash animation. */
  changeCents24h?: number;
  trend: PredictionTrend;
  category: PredictionCategory;
  tags: string[];
  volumeUsd: number;
  liquidityUsd: number;
  txns: number;
  txnBuys: number;
  txnSells: number;
  traders: number;
  endsIn: string;
  closeTime?: string;
  spark: number[];
  featured?: boolean;
  emoji: string;
  iconUrl?: string;
  /** Related alpha links for hero carousel scroll. */
  alphaFeed?: PredictionAlphaItem[];
  /** Recent public trades for active-buy strip. */
  recentTrades?: PredictionRecentTrade[];
}

export type PredictionRecentTrade = {
  id: string;
  side: 'yes' | 'no';
  priceCents: number;
  count: number;
  ts: number;
};

export type PredictionMarketsResponse = {
  markets: PredictionMarket[];
  cursor: string | null;
  source: 'kalshi' | 'demo';
  live: boolean;
};
