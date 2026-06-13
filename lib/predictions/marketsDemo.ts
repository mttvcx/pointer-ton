/**
 * Demo prediction market fixtures — Kalshi partnership preview.
 * Replace with API integration when partnership ships; not used in execution paths.
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

export type PredictionDeskCategory =
  | 'Trending'
  | 'All'
  | 'Crypto'
  | 'Sports'
  | 'Politics'
  | 'Watchlist';

export type PredictionSort = 'volume' | 'liquidity' | 'newest';

export type PredictionView = 'table' | 'cards';

export interface PredictionMarket {
  id: string;
  title: string;
  /** Primary outcome label shown under title (e.g. "Yes", "Spain"). */
  outcomeLabel: string;
  yesPct: number;
  yesPriceCents: number;
  noPriceCents: number;
  changePct24h: number;
  trend: PredictionTrend;
  category: PredictionCategory;
  /** Tag chips for All-view sidebar (Politics, Trump, etc.). */
  tags: string[];
  volumeUsd: number;
  liquidityUsd: number;
  txns: number;
  txnBuys: number;
  txnSells: number;
  traders: number;
  endsIn: string;
  spark: number[];
  featured?: boolean;
  emoji: string;
  /** Optional explicit icon URL (crypto logos, etc.). */
  iconUrl?: string;
}

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
    title: 'World Cup Winner',
    outcomeLabel: 'Spain',
    yesPct: 17,
    yesPriceCents: 16.9,
    changePct24h: 0.3,
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
    title: 'Presidential Election Winner 2028',
    outcomeLabel: 'Gavin Newsom',
    yesPct: 15,
    yesPriceCents: 15.2,
    changePct24h: -0.4,
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
    title: 'What price will Ethereum hit in 2026?',
    outcomeLabel: '↑ $1,500',
    yesPct: 85,
    yesPriceCents: 84.8,
    changePct24h: 1.2,
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
    id: 'paraguay-win',
    title: 'Will Paraguay win on 2026-06-12?',
    outcomeLabel: 'Yes',
    yesPct: 24,
    yesPriceCents: 24.0,
    changePct24h: 8.0,
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
    id: 'tigers-guardians',
    title: 'Detroit Tigers vs. Cleveland Guardians',
    outcomeLabel: 'Yes',
    yesPct: 54,
    yesPriceCents: 54.0,
    changePct24h: 0,
    trend: 'flat',
    category: 'Sports',
    tags: ['Sports', 'MLB'],
    volumeUsd: 37_500,
    liquidityUsd: 404_000,
    txns: 9,
    txnBuys: 9,
    txnSells: 0,
    traders: 9,
    endsIn: '7d',
    emoji: '⚾',
  }),
  mk({
    id: 'trump-iran',
    title: 'Will Donald Trump visit Iran in 2026?',
    outcomeLabel: 'Yes',
    yesPct: 8,
    yesPriceCents: 8.2,
    changePct24h: -8.8,
    trend: 'down',
    category: 'Politics',
    tags: ['Politics', 'Trump', 'Iran'],
    volumeUsd: 128_000,
    liquidityUsd: 890_000,
    txns: 44,
    txnBuys: 12,
    txnSells: 32,
    traders: 38,
    endsIn: '12m',
    emoji: '🌐',
  }),
  mk({
    id: 'btc-120k',
    title: 'BTC above $120k this year',
    outcomeLabel: 'Yes',
    yesPct: 62,
    yesPriceCents: 61.5,
    changePct24h: 2.1,
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
    id: 'fed-june',
    title: 'Fed cuts in June',
    outcomeLabel: 'Yes',
    yesPct: 74,
    yesPriceCents: 73.8,
    changePct24h: 0.6,
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
    title: 'SOL ETF approved in 2026',
    outcomeLabel: 'Yes',
    yesPct: 41,
    yesPriceCents: 40.8,
    changePct24h: -1.4,
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
  mk({
    id: 'spain-world-cup',
    title: 'Will Spain win the 2026 FIFA World Cup?',
    outcomeLabel: 'Yes',
    yesPct: 17,
    yesPriceCents: 16.8,
    changePct24h: 0.2,
    trend: 'up',
    category: 'Sports',
    tags: ['Sports', 'World Cup'],
    volumeUsd: 2_150_000,
    liquidityUsd: 429_000,
    txns: 310,
    txnBuys: 198,
    txnSells: 112,
    traders: 240,
    endsIn: '37d',
    emoji: '🇪🇸',
  }),
  mk({
    id: 'nvda-green',
    title: 'Nvidia closes green this week',
    outcomeLabel: 'Yes',
    yesPct: 66,
    yesPriceCents: 65.5,
    changePct24h: 3.2,
    trend: 'up',
    category: 'Stocks',
    tags: ['Stocks', 'NVDA'],
    volumeUsd: 2_100_000,
    liquidityUsd: 540_000,
    txns: 88,
    txnBuys: 61,
    txnSells: 27,
    traders: 64,
    endsIn: '4d',
    emoji: '📈',
  }),
  mk({
    id: 'ai-benchmark',
    title: 'Frontier model hits public benchmark >90% by Q4',
    outcomeLabel: 'Yes',
    yesPct: 34,
    yesPriceCents: 33.6,
    changePct24h: 4.5,
    trend: 'up',
    category: 'AI',
    tags: ['AI', 'Anthropic'],
    volumeUsd: 1_400_000,
    liquidityUsd: 320_000,
    txns: 42,
    txnBuys: 30,
    txnSells: 12,
    traders: 36,
    endsIn: '5mo',
    emoji: '🤖',
  }),
  mk({
    id: 'super-bowl-total',
    title: 'Super Bowl total points over 47.5',
    outcomeLabel: 'Yes',
    yesPct: 52,
    yesPriceCents: 51.8,
    changePct24h: -0.3,
    trend: 'flat',
    category: 'Sports',
    tags: ['Sports', 'NFL'],
    volumeUsd: 6_800_000,
    liquidityUsd: 1_100_000,
    txns: 204,
    txnBuys: 110,
    txnSells: 94,
    traders: 156,
    endsIn: '3mo',
    emoji: '🏈',
  }),
  mk({
    id: 'dem-nom-2028',
    title: 'Democratic Presidential Nominee 2028',
    outcomeLabel: 'Gavin Newsom',
    yesPct: 23,
    yesPriceCents: 22.8,
    changePct24h: 1.1,
    trend: 'up',
    category: 'Politics',
    tags: ['Politics', '2028'],
    volumeUsd: 45_000_000,
    liquidityUsd: 8_200_000,
    txns: 1802,
    txnBuys: 1100,
    txnSells: 702,
    traders: 920,
    endsIn: '2y',
    emoji: '🗳️',
  }),
];

export function noPct(yes: number): number {
  return Math.max(0, Math.min(100, 100 - yes));
}

export function getPredictionMarket(id: string): PredictionMarket | null {
  return KALSHI_PREDICTION_MARKETS.find((m) => m.id === id) ?? null;
}

export function filterPredictionMarkets(params: {
  deskCategory: PredictionDeskCategory;
  tag?: string | null;
  query?: string;
  sort: PredictionSort;
}): PredictionMarket[] {
  let rows = [...KALSHI_PREDICTION_MARKETS];
  const q = params.query?.trim().toLowerCase();

  if (params.deskCategory === 'Trending') {
    rows = rows.filter((m) => m.featured || m.volumeUsd >= 1_000_000);
  } else if (params.deskCategory === 'Crypto') {
    rows = rows.filter((m) => m.category === 'Crypto' || m.category === 'ETFs');
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
  'Iran',
  'Crypto',
  'Sports',
  'Politics',
  '2028',
  'World Cup',
  'Fed',
  'AI',
] as const;
