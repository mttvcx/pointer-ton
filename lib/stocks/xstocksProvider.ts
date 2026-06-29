import type {
  SyntheticStockMarket,
  SyntheticStockProvider,
  SyntheticStockQuote,
} from '@/lib/stocks/types';

/**
 * LIVE xStocks provider — real tokenized-equity market data from Jupiter, served
 * via `/api/stocks/markets`. Markets/quotes are real; candles + orderbook are left
 * to the real `/token/[mint]` trade page (xStocks are SPL tokens, so the existing
 * Solana chart + Jupiter swap pipeline owns execution and the price chart).
 */

let marketsCache: { at: number; markets: SyntheticStockMarket[] } | null = null;
const CLIENT_TTL_MS = 20_000;

async function loadMarkets(): Promise<SyntheticStockMarket[]> {
  if (marketsCache && Date.now() - marketsCache.at < CLIENT_TTL_MS) return marketsCache.markets;
  try {
    const res = await fetch('/api/stocks/markets', { cache: 'no-store' });
    if (!res.ok) throw new Error(`stocks_markets_http_${res.status}`);
    const json = (await res.json()) as { markets?: SyntheticStockMarket[] };
    const markets = Array.isArray(json.markets) ? json.markets : [];
    if (markets.length > 0 || !marketsCache) marketsCache = { at: Date.now(), markets };
    return marketsCache?.markets ?? markets;
  } catch {
    return marketsCache?.markets ?? [];
  }
}

export const xstocksProvider: SyntheticStockProvider = {
  id: 'xstocks',
  label: 'xStocks (Backed) · live',
  isLive: true,
  getMarkets: () => loadMarkets(),
  getMarketBySymbol: async (symbol) => {
    const markets = await loadMarkets();
    const want = symbol.toLowerCase();
    return (
      markets.find((m) => m.symbol.toLowerCase() === want) ??
      // tolerate base ticker (TSLA → TSLAx)
      markets.find((m) => m.symbol.toLowerCase().replace(/x$/, '') === want.replace(/x$/, '')) ??
      null
    );
  },
  getQuote: async (symbol): Promise<SyntheticStockQuote | null> => {
    const markets = await loadMarkets();
    const m = markets.find((x) => x.symbol.toLowerCase() === symbol.toLowerCase());
    if (!m) return null;
    return {
      symbol: m.symbol,
      priceUsd: m.priceUsd,
      change24hPct: m.change24hPct,
      bid: null,
      ask: null,
      fundingRatePct: null,
      openInterestUsd: null,
      updatedAt: new Date().toISOString(),
    };
  },
  // Real chart + depth live on /token/[mint] (the existing Solana token page).
  getCandles: async () => [],
  getOrderbook: async () => null,
};
