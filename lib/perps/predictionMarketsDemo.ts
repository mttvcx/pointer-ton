/**
 * Demo-only prediction market fixtures for Perps UI.
 * Replace with API integration when a partnership ships; do not import from execution paths.
 */

export type PredictionCategory =
  | 'Crypto'
  | 'Macro'
  | 'Politics'
  | 'AI'
  | 'Stocks'
  | 'Sports'
  | 'ETFs';

export type PredictionTrend = 'up' | 'down' | 'flat';

export interface PredictionMarketDemo {
  id: string;
  title: string;
  yesPct: number;
  trend: PredictionTrend;
  /** Mock 24h notional, millions USD */
  volumeUsdM?: number;
  openInterestUsdM?: number;
  category: PredictionCategory;
  /** 0–1 samples for mini sparkline (UI only) */
  spark: number[];
}

function sparkFor(yes: number, trend: PredictionTrend): number[] {
  const n = 9;
  const out: number[] = [];
  let v = Math.max(0.08, Math.min(0.92, yes / 100 - 0.06));
  for (let i = 0; i < n; i++) {
    const wave = Math.sin(i * 0.55) * 0.02;
    const drift = trend === 'up' ? i * 0.008 : trend === 'down' ? -i * 0.006 : 0;
    v = Math.max(0.05, Math.min(0.95, v + wave * 0.5 + drift));
    out.push(v);
  }
  out[n - 1] = Math.max(0.05, Math.min(0.95, yes / 100));
  return out;
}

export const DEMO_PREDICTION_MARKETS: PredictionMarketDemo[] = [
  {
    id: 'btc-120k',
    title: 'BTC above $120k this year',
    yesPct: 62,
    trend: 'up',
    volumeUsdM: 12.4,
    openInterestUsdM: 4.1,
    category: 'Crypto',
    spark: sparkFor(62, 'up'),
  },
  {
    id: 'sol-etf',
    title: 'SOL ETF approved in 2026',
    yesPct: 41,
    trend: 'down',
    volumeUsdM: 3.2,
    category: 'ETFs',
    spark: sparkFor(41, 'down'),
  },
  {
    id: 'fed-june',
    title: 'Fed cuts in June',
    yesPct: 74,
    trend: 'up',
    volumeUsdM: 28.9,
    category: 'Macro',
    spark: sparkFor(74, 'up'),
  },
  {
    id: 'eth-ath',
    title: 'Ethereum ATH this cycle',
    yesPct: 57,
    trend: 'flat',
    volumeUsdM: 9.7,
    category: 'Crypto',
    spark: sparkFor(57, 'flat'),
  },
  {
    id: 'trump',
    title: 'Trump wins election',
    yesPct: 48,
    trend: 'down',
    volumeUsdM: 140.2,
    category: 'Politics',
    spark: sparkFor(48, 'down'),
  },
  {
    id: 'nvda',
    title: 'Nvidia closes green this week',
    yesPct: 66,
    trend: 'up',
    volumeUsdM: 2.1,
    category: 'Stocks',
    spark: sparkFor(66, 'up'),
  },
  {
    id: 'ai-frontier',
    title: 'Frontier model hits public benchmark >90% by Q4',
    yesPct: 34,
    trend: 'up',
    volumeUsdM: 1.4,
    category: 'AI',
    spark: sparkFor(34, 'up'),
  },
  {
    id: 'nfl',
    title: 'Super Bowl total points over 47.5',
    yesPct: 52,
    trend: 'flat',
    volumeUsdM: 6.8,
    category: 'Sports',
    spark: sparkFor(52, 'flat'),
  },
];

export interface SentimentSummaryDemo {
  crowdPositioning: string;
  lines: { label: string; value: string; hint?: string }[];
}

export const DEMO_SENTIMENT_SUMMARY: SentimentSummaryDemo = {
  crowdPositioning: 'Risk-on',
  lines: [
    { label: 'BTC yearly outlook', value: 'Bullish 68%', hint: 'Derived from top crypto markets' },
    { label: 'ETH ETF odds', value: 'Approved 44%' },
    { label: 'Fed rate cut odds', value: '71%' },
  ],
};

export function noPct(yes: number): number {
  return Math.max(0, Math.min(100, 100 - yes));
}
