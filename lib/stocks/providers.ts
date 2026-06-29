import {
  getMockCandles,
  getMockMarketBySymbol,
  getMockMarkets,
  getMockOrderbook,
  getMockQuote,
} from '@/lib/stocks/mockStocks';
import { xstocksProvider } from '@/lib/stocks/xstocksProvider';
import type { SyntheticStockProvider } from '@/lib/stocks/types';

// Phase 1 (LIVE): xStocks (Backed) via Jupiter — see `xstocksProvider`.
// TODO Phase 2: Hyperliquid HIP-3 / TradeXYZ perps adapter for pre-IPO + leverage.

const mockProvider: SyntheticStockProvider = {
  id: 'mock',
  label: 'Demo synthetic markets',
  isLive: false,
  getMarkets: async () => getMockMarkets(),
  getMarketBySymbol: async (symbol) => getMockMarketBySymbol(symbol),
  getCandles: async (symbol, interval) => getMockCandles(symbol, interval),
  getQuote: async (symbol) => getMockQuote(symbol),
  getOrderbook: async (symbol) => getMockOrderbook(symbol),
};

// Live by default. Set NEXT_PUBLIC_STOCKS_PROVIDER=mock to force the demo fixture.
let activeProvider: SyntheticStockProvider =
  process.env.NEXT_PUBLIC_STOCKS_PROVIDER === 'mock' ? mockProvider : xstocksProvider;

export function getSyntheticStockProvider(): SyntheticStockProvider {
  return activeProvider;
}

export function isSyntheticStocksDemoMode(): boolean {
  return !getSyntheticStockProvider().isLive;
}

export function setSyntheticStockProvider(provider: SyntheticStockProvider): void {
  activeProvider = provider;
}
