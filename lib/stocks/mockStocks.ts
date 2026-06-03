import type { SyntheticStockCandle, SyntheticStockMarket, SyntheticStockOrderbook, SyntheticStockQuote } from '@/lib/stocks/types';

/** Demo notional market caps for Pulse-style MC column. */
const DEMO_MARKET_CAP_USD: Record<string, number> = {
  OPENAI: 180_000_000_000,
  SPACEX: 350_000_000_000,
  ANTHROPIC: 62_000_000_000,
  STRIPE: 95_000_000_000,
  XAI: 24_000_000_000,
  PERPLEXITY: 14_000_000_000,
  TSLA: 780_000_000_000,
  NVDA: 2_200_000_000_000,
  MSTR: 68_000_000_000,
  COIN: 52_000_000_000,
  HOOD: 22_000_000_000,
  AAPL: 3_100_000_000_000,
  MSFT: 3_200_000_000_000,
  AMZN: 1_900_000_000_000,
  META: 1_250_000_000_000,
  GOOGL: 2_100_000_000_000,
  SPX: 45_000_000_000_000,
};

type MockStockRow = Omit<SyntheticStockMarket, 'category' | 'marketCapUsd'>;

const PRE_IPO: MockStockRow[] = [
  {
    symbol: 'OPENAI',
    name: 'OpenAI',
    marketType: 'pre_ipo',
    priceUsd: 186.4,
    change24hPct: 2.8,
    volume24hUsd: 42_000_000,
    openInterestUsd: 18_500_000,
    fundingRatePct: 0.012,
    liquidityUsd: 9_200_000,
    aiSummary: 'High-attention pre-IPO perp. Funding elevated; OI building into earnings chatter.',
  },
  {
    symbol: 'SPACEX',
    name: 'SpaceX',
    marketType: 'pre_ipo',
    priceUsd: 112.2,
    change24hPct: -1.4,
    volume24hUsd: 28_500_000,
    openInterestUsd: 12_100_000,
    fundingRatePct: -0.006,
    liquidityUsd: 6_400_000,
    aiSummary: 'Pre-IPO equity perp with steady two-sided flow. Watch launch window headlines.',
  },
  {
    symbol: 'ANTHROPIC',
    name: 'Anthropic',
    marketType: 'pre_ipo',
    priceUsd: 94.7,
    change24hPct: 4.1,
    volume24hUsd: 19_200_000,
    openInterestUsd: 8_900_000,
    fundingRatePct: 0.018,
    liquidityUsd: 4_100_000,
    aiSummary: 'AI lab synthetic tape. Momentum longs dominant; funding skew positive.',
  },
  {
    symbol: 'STRIPE',
    name: 'Stripe',
    marketType: 'pre_ipo',
    priceUsd: 68.3,
    change24hPct: 0.6,
    volume24hUsd: 15_800_000,
    openInterestUsd: 6_200_000,
    fundingRatePct: 0.004,
    liquidityUsd: 3_800_000,
    aiSummary: 'Fintech pre-IPO perp. Range-bound; liquidity adequate for size tests only.',
  },
  {
    symbol: 'XAI',
    name: 'xAI',
    marketType: 'pre_ipo',
    priceUsd: 41.9,
    change24hPct: 6.2,
    volume24hUsd: 22_400_000,
    openInterestUsd: 9_700_000,
    fundingRatePct: 0.022,
    liquidityUsd: 2_900_000,
    aiSummary: 'Volatile pre-IPO synthetic. Social velocity high; widen slippage assumptions.',
  },
  {
    symbol: 'PERPLEXITY',
    name: 'Perplexity',
    marketType: 'pre_ipo',
    priceUsd: 33.5,
    change24hPct: -2.9,
    volume24hUsd: 11_300_000,
    openInterestUsd: 4_800_000,
    fundingRatePct: -0.011,
    liquidityUsd: 1_900_000,
    aiSummary: 'Search/AI synthetic pre-IPO. Short interest ticked up overnight.',
  },
];

const HOT: MockStockRow[] = [
  {
    symbol: 'TSLA',
    name: 'Tesla',
    marketType: 'public_equity',
    priceUsd: 248.6,
    change24hPct: 3.4,
    volume24hUsd: 890_000_000,
    openInterestUsd: 210_000_000,
    fundingRatePct: 0.008,
    liquidityUsd: 120_000_000,
    aiSummary: '24/7 synthetic TSLA perp. Macro-sensitive; funding mild long bias.',
  },
  {
    symbol: 'NVDA',
    name: 'NVIDIA',
    marketType: 'public_equity',
    priceUsd: 892.1,
    change24hPct: 1.9,
    volume24hUsd: 1_200_000_000,
    openInterestUsd: 340_000_000,
    fundingRatePct: 0.014,
    liquidityUsd: 200_000_000,
    aiSummary: 'AI complex proxy. Deepest book in Hot lane; tight spreads in demo.',
  },
  {
    symbol: 'MSTR',
    name: 'MicroStrategy',
    marketType: 'crypto_equity',
    priceUsd: 412.8,
    change24hPct: 5.7,
    volume24hUsd: 380_000_000,
    openInterestUsd: 95_000_000,
    fundingRatePct: 0.031,
    liquidityUsd: 48_000_000,
    aiSummary: 'BTC-beta synthetic equity. Funding rich; momentum longs crowded.',
  },
  {
    symbol: 'COIN',
    name: 'Coinbase',
    marketType: 'crypto_equity',
    priceUsd: 198.4,
    change24hPct: -0.8,
    volume24hUsd: 290_000_000,
    openInterestUsd: 72_000_000,
    fundingRatePct: -0.003,
    liquidityUsd: 41_000_000,
    aiSummary: 'Crypto exchange equity perp. Tracks BTC regime; neutral funding.',
  },
  {
    symbol: 'HOOD',
    name: 'Robinhood',
    marketType: 'public_equity',
    priceUsd: 22.7,
    change24hPct: 2.1,
    volume24hUsd: 140_000_000,
    openInterestUsd: 38_000_000,
    fundingRatePct: 0.009,
    liquidityUsd: 19_000_000,
    aiSummary: 'Retail flow proxy synthetic. Meme-adjacent bursts possible off headlines.',
  },
];

const TOP: MockStockRow[] = [
  {
    symbol: 'AAPL',
    name: 'Apple',
    marketType: 'public_equity',
    priceUsd: 198.2,
    change24hPct: 0.4,
    volume24hUsd: 620_000_000,
    openInterestUsd: 180_000_000,
    fundingRatePct: 0.002,
    liquidityUsd: 95_000_000,
    aiSummary: 'Mega-cap synthetic. Low vol grind; carry-friendly funding.',
  },
  {
    symbol: 'MSFT',
    name: 'Microsoft',
    marketType: 'public_equity',
    priceUsd: 428.5,
    change24hPct: 0.9,
    volume24hUsd: 540_000_000,
    openInterestUsd: 150_000_000,
    fundingRatePct: 0.003,
    liquidityUsd: 88_000_000,
    aiSummary: 'Cloud/AI bellwether synthetic. Steady two-sided liquidity.',
  },
  {
    symbol: 'AMZN',
    name: 'Amazon',
    marketType: 'public_equity',
    priceUsd: 186.7,
    change24hPct: -0.3,
    volume24hUsd: 480_000_000,
    openInterestUsd: 120_000_000,
    fundingRatePct: -0.001,
    liquidityUsd: 72_000_000,
    aiSummary: 'E-commerce + cloud synthetic. Neutral tape overnight.',
  },
  {
    symbol: 'META',
    name: 'Meta',
    marketType: 'public_equity',
    priceUsd: 512.3,
    change24hPct: 1.2,
    volume24hUsd: 410_000_000,
    openInterestUsd: 98_000_000,
    fundingRatePct: 0.005,
    liquidityUsd: 65_000_000,
    aiSummary: 'Ad/AI synthetic equity perp. Stable funding; ad cycle headlines matter.',
  },
  {
    symbol: 'GOOGL',
    name: 'Alphabet',
    marketType: 'public_equity',
    priceUsd: 176.9,
    change24hPct: 0.7,
    volume24hUsd: 390_000_000,
    openInterestUsd: 88_000_000,
    fundingRatePct: 0.004,
    liquidityUsd: 58_000_000,
    aiSummary: 'Search/AI synthetic. Index weight heavy; slower intraday ranges.',
  },
  {
    symbol: 'SPX',
    name: 'US Index',
    marketType: 'index',
    priceUsd: 5284.2,
    change24hPct: 0.2,
    volume24hUsd: 2_100_000_000,
    openInterestUsd: 520_000_000,
    fundingRatePct: 0.001,
    liquidityUsd: 400_000_000,
    aiSummary: 'Broad US equity index perp. Macro hedge lane; deepest demo liquidity.',
  },
];

function withCategory(rows: MockStockRow[], category: SyntheticStockMarket['category']): SyntheticStockMarket[] {
  return rows.map((r) => ({
    ...r,
    category,
    marketCapUsd: DEMO_MARKET_CAP_USD[r.symbol] ?? r.volume24hUsd * 40,
  }));
}

export const MOCK_STOCK_MARKETS: SyntheticStockMarket[] = [
  ...withCategory(PRE_IPO, 'pre_ipo'),
  ...withCategory(HOT, 'hot'),
  ...withCategory(TOP, 'top'),
];

export function getMockMarkets(): SyntheticStockMarket[] {
  return MOCK_STOCK_MARKETS;
}

export function getMockMarketBySymbol(symbol: string): SyntheticStockMarket | null {
  const key = symbol.trim().toUpperCase();
  return MOCK_STOCK_MARKETS.find((m) => m.symbol === key) ?? null;
}

export function getMockQuote(symbol: string): SyntheticStockQuote | null {
  const m = getMockMarketBySymbol(symbol);
  if (!m) return null;
  return {
    symbol: m.symbol,
    priceUsd: m.priceUsd,
    change24hPct: m.change24hPct,
    bid: m.priceUsd * 0.9998,
    ask: m.priceUsd * 1.0002,
    fundingRatePct: m.fundingRatePct,
    openInterestUsd: m.openInterestUsd,
    updatedAt: new Date().toISOString(),
  };
}

export function getMockCandles(symbol: string, _interval: string): SyntheticStockCandle[] {
  const m = getMockMarketBySymbol(symbol);
  if (!m) return [];
  const base = m.priceUsd;
  const now = Date.now();
  return Array.from({ length: 48 }, (_, i) => {
    const t = now - (47 - i) * 15 * 60_000;
    const drift = Math.sin(i / 4) * base * 0.008;
    const o = base + drift;
    const c = o + (Math.random() - 0.5) * base * 0.004;
    return {
      time: t,
      open: o,
      high: Math.max(o, c) + base * 0.002,
      low: Math.min(o, c) - base * 0.002,
      close: c,
      volume: m.volume24hUsd / 48,
    };
  });
}

export function getMockOrderbook(symbol: string): SyntheticStockOrderbook | null {
  const q = getMockQuote(symbol);
  if (!q) return null;
  const p = q.priceUsd;
  return {
    symbol: q.symbol,
    bids: Array.from({ length: 8 }, (_, i) => ({
      price: p * (1 - 0.0002 * (i + 1)),
      size: 1200 + i * 400,
    })),
    asks: Array.from({ length: 8 }, (_, i) => ({
      price: p * (1 + 0.0002 * (i + 1)),
      size: 1100 + i * 380,
    })),
  };
}
