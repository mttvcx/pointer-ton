/**
 * Legacy shim — prediction markets moved to `/predictions` (Kalshi).
 * @deprecated Import from `@/lib/predictions/marketsDemo`.
 */
import {
  KALSHI_PREDICTION_MARKETS,
  type PredictionCategory,
  type PredictionTrend,
} from '@/lib/predictions/marketsDemo';

export type { PredictionCategory, PredictionTrend };

export type PredictionMarketDemo = {
  id: string;
  title: string;
  yesPct: number;
  trend: PredictionTrend;
  volumeUsdM?: number;
  openInterestUsdM?: number;
  category: PredictionCategory;
  spark: number[];
};

export const DEMO_PREDICTION_MARKETS: PredictionMarketDemo[] = KALSHI_PREDICTION_MARKETS.map(
  (m) => ({
    id: m.id,
    title: m.title,
    yesPct: m.yesPct,
    trend: m.trend,
    volumeUsdM: m.volumeUsd / 1_000_000,
    openInterestUsdM: m.liquidityUsd / 1_000_000,
    category: m.category,
    spark: m.spark,
  }),
);

export function noPct(yes: number): number {
  return Math.max(0, Math.min(100, 100 - yes));
}

export interface SentimentSummaryDemo {
  crowdPositioning: string;
  lines: { label: string; value: string; hint?: string }[];
}

export const DEMO_SENTIMENT_SUMMARY: SentimentSummaryDemo = {
  crowdPositioning: 'Risk-on',
  lines: [
    { label: 'BTC yearly outlook', value: 'Bullish 68%', hint: 'Kalshi crypto markets' },
    { label: 'Fed rate cut odds', value: '71%' },
  ],
};
