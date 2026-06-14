/**
 * Demo prediction market fixtures — fallback when Kalshi API is unavailable.
 */

export type {
  PredictionAlphaItem,
  PredictionCategory,
  PredictionDeskCategory,
  PredictionMarket,
  PredictionMarketsResponse,
  PredictionRecentTrade,
  PredictionSort,
  PredictionTrend,
  PredictionView,
} from '@/lib/predictions/types';

import type {
  PredictionDeskCategory,
  PredictionMarket,
  PredictionSort,
  PredictionTrend,
} from '@/lib/predictions/types';
import { isCryptoPredictionMarket } from '@/lib/predictions/groupMarkets';

function sparkFor(yes: number, trend: PredictionTrend): number[] {
  const n = 12;
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

function mk(
  partial: Omit<PredictionMarket, 'spark' | 'noPriceCents'> & { trend: PredictionTrend },
): PredictionMarket {
  const yesPriceCents = partial.yesPriceCents;
  return {
    ...partial,
    noPriceCents: Math.max(0.1, Math.round((100 - yesPriceCents) * 10) / 10),
    spark: sparkFor(partial.yesPct, partial.trend),
  };
}

export const KALSHI_PREDICTION_MARKETS: PredictionMarket[] = [
  mk({
    id: 'world-cup-winner',
    ticker: 'world-cup-winner',
    title: 'World Cup Winner',
    outcomeLabel: 'Spain',
    yesPct: 17,
    yesPriceCents: 16.9,
    changePct24h: 0.3,
    changeCents24h: 0.3,
    trend: 'up',
    category: 'Sports',
    tags: ['Sports', 'World Cup'],
    volumeUsd: 2_150_000_000,
    liquidityUsd: 429_000_000,
    txns: 4821,
    txnBuys: 3102,
    txnSells: 1719,
    traders: 1840,
    endsIn: '1mo',
    featured: true,
    emoji: '🏆',
  }),
  mk({
    id: 'pres-2028',
    ticker: 'pres-2028',
    title: 'Presidential Election Winner 2028',
    outcomeLabel: 'Gavin Newsom',
    yesPct: 15,
    yesPriceCents: 15.2,
    changePct24h: -0.4,
    changeCents24h: -0.2,
    trend: 'down',
    category: 'Politics',
    tags: ['Politics', 'Trump', '2028'],
    volumeUsd: 826_000_000,
    liquidityUsd: 35_400_000,
    txns: 9204,
    txnBuys: 5011,
    txnSells: 4193,
    traders: 6200,
    endsIn: '2y',
    featured: true,
    emoji: '🗳️',
  }),
  mk({
    id: 'eth-2026-high',
    ticker: 'eth-2026-high',
    eventTicker: 'demo-eth-2026-price',
    title: 'What price will Ethereum hit in 2026?',
    outcomeLabel: '↑ $1,500',
    yesPct: 85,
    yesPriceCents: 84.8,
    changePct24h: 1.2,
    changeCents24h: 0.8,
    trend: 'up',
    category: 'Crypto',
    tags: ['Crypto', 'ETH'],
    volumeUsd: 12_400_000,
    liquidityUsd: 2_100_000,
    txns: 340,
    txnBuys: 210,
    txnSells: 130,
    traders: 188,
    endsIn: '10mo',
    featured: true,
    emoji: 'Ξ',
    iconUrl: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
  }),
  mk({
    id: 'sol-2026-high',
    ticker: 'sol-2026-high',
    eventTicker: 'demo-sol-2026-price',
    title: 'What price will Solana hit in 2026?',
    outcomeLabel: '↑ $200',
    yesPct: 42,
    yesPriceCents: 41.5,
    changePct24h: 0.7,
    changeCents24h: 0.7,
    trend: 'up',
    category: 'Crypto',
    tags: ['Crypto', 'SOL'],
    volumeUsd: 915_000,
    liquidityUsd: 158_000,
    txns: 210,
    txnBuys: 130,
    txnSells: 80,
    traders: 142,
    endsIn: '10mo',
    featured: true,
    emoji: '◎',
    iconUrl: 'https://assets.coingecko.com/coins/images/4128/small/solana.png',
  }),
  mk({
    id: 'paraguay-win',
    ticker: 'paraguay-win',
    title: 'Will Paraguay win on 2026-06-12?',
    outcomeLabel: 'Yes',
    yesPct: 24,
    yesPriceCents: 24.0,
    changePct24h: 8.0,
    changeCents24h: 1.5,
    trend: 'up',
    category: 'Sports',
    tags: ['Sports', 'Soccer'],
    volumeUsd: 484,
    liquidityUsd: 2_600_000,
    txns: 21,
    txnBuys: 19,
    txnSells: 2,
    traders: 17,
    endsIn: '2h',
    emoji: '⚽',
  }),
  mk({
    id: 'btc-120k',
    ticker: 'btc-120k',
    eventTicker: 'demo-btc-2026-price',
    title: 'What price will Bitcoin hit in 2026?',
    outcomeLabel: '↑ $120,000',
    yesPct: 62,
    yesPriceCents: 61.5,
    changePct24h: 2.1,
    changeCents24h: 1.1,
    trend: 'up',
    category: 'Crypto',
    tags: ['Crypto', 'BTC'],
    volumeUsd: 12_400_000,
    liquidityUsd: 4_100_000,
    txns: 892,
    txnBuys: 520,
    txnSells: 372,
    traders: 410,
    endsIn: '8mo',
    emoji: '₿',
    iconUrl: 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png',
  }),
  mk({
    id: 'btc-500k',
    ticker: 'btc-500k',
    eventTicker: 'demo-btc-2026-price',
    title: 'What price will Bitcoin hit in 2026?',
    outcomeLabel: '↑ $500,000',
    yesPct: 2,
    yesPriceCents: 1.5,
    changePct24h: 0.1,
    changeCents24h: 0.1,
    trend: 'flat',
    category: 'Crypto',
    tags: ['Crypto', 'BTC'],
    volumeUsd: 42_500_000,
    liquidityUsd: 1_990_000,
    txns: 1204,
    txnBuys: 701,
    txnSells: 503,
    traders: 890,
    endsIn: '6mo',
    featured: true,
    emoji: '₿',
    iconUrl: 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png',
  }),
  mk({
    id: 'btc-250k',
    ticker: 'btc-250k',
    eventTicker: 'demo-btc-2026-price',
    title: 'What price will Bitcoin hit in 2026?',
    outcomeLabel: '↑ $250,000',
    yesPct: 2,
    yesPriceCents: 2.1,
    changePct24h: 0.2,
    changeCents24h: 0.2,
    trend: 'up',
    category: 'Crypto',
    tags: ['Crypto', 'BTC'],
    volumeUsd: 38_200_000,
    liquidityUsd: 1_720_000,
    txns: 980,
    txnBuys: 560,
    txnSells: 420,
    traders: 720,
    endsIn: '6mo',
    featured: true,
    emoji: '₿',
    iconUrl: 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png',
  }),
  mk({
    id: 'fed-june',
    ticker: 'fed-june',
    title: 'Fed cuts in June',
    outcomeLabel: 'Yes',
    yesPct: 74,
    yesPriceCents: 73.8,
    changePct24h: 0.6,
    changeCents24h: 0.4,
    trend: 'up',
    category: 'Macro',
    tags: ['Macro', 'Fed'],
    volumeUsd: 28_900_000,
    liquidityUsd: 6_200_000,
    txns: 1204,
    txnBuys: 801,
    txnSells: 403,
    traders: 890,
    endsIn: '18d',
    emoji: '🏦',
  }),
  mk({
    id: 'sol-etf',
    ticker: 'sol-etf',
    title: 'SOL ETF approved in 2026',
    outcomeLabel: 'Yes',
    yesPct: 41,
    yesPriceCents: 40.8,
    changePct24h: -1.4,
    changeCents24h: -0.6,
    trend: 'down',
    category: 'ETFs',
    tags: ['Crypto', 'SOL', 'ETFs'],
    volumeUsd: 3_200_000,
    liquidityUsd: 980_000,
    txns: 156,
    txnBuys: 70,
    txnSells: 86,
    traders: 102,
    endsIn: '6mo',
    emoji: '◎',
    iconUrl: 'https://assets.coingecko.com/coins/images/4128/small/solana.png',
  }),
];

export function noPct(yes: number): number {
  return Math.max(0, Math.min(100, 100 - yes));
}

export function getPredictionMarket(id: string): PredictionMarket | null {
  return KALSHI_PREDICTION_MARKETS.find((m) => m.id === id || m.ticker === id) ?? null;
}

export function filterPredictionMarkets(params: {
  markets?: PredictionMarket[];
  deskCategory: PredictionDeskCategory;
  tag?: string | null;
  query?: string;
  sort: PredictionSort;
}): PredictionMarket[] {
  let rows = [...(params.markets ?? KALSHI_PREDICTION_MARKETS)];
  const q = params.query?.trim().toLowerCase();

  if (params.deskCategory === 'Trending') {
    rows = rows.filter((m) => m.featured || m.volumeUsd >= 50_000);
  } else if (params.deskCategory === 'Crypto') {
    rows = rows.filter(isCryptoPredictionMarket);
  } else if (params.deskCategory === 'Sports') {
    rows = rows.filter((m) => m.category === 'Sports');
  } else if (params.deskCategory === 'Politics') {
    rows = rows.filter((m) => m.category === 'Politics' || m.category === 'Macro');
  } else if (params.deskCategory === 'Watchlist') {
    rows = rows.slice(0, 4);
  }

  if (params.tag) {
    rows = rows.filter((m) => m.tags.includes(params.tag!));
  }

  if (q) {
    rows = rows.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        m.outcomeLabel.toLowerCase().includes(q) ||
        m.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }

  switch (params.sort) {
    case 'liquidity':
      rows.sort((a, b) => b.liquidityUsd - a.liquidityUsd);
      break;
    case 'newest':
      rows.reverse();
      break;
    default:
      rows.sort((a, b) => b.volumeUsd - a.volumeUsd);
  }

  return rows;
}

export const ALL_PREDICTION_TAGS = [
  'All',
  'Trump',
  'Crypto',
  'Sports',
  'Politics',
  '2028',
  'World Cup',
  'Fed',
  'AI',
  'SOL',
  'BTC',
] as const;
