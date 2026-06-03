import {
  getMockCandles,
  getMockMarketBySymbol,
  getMockMarkets,
  getMockOrderbook,
  getMockQuote,
} from '@/lib/stocks/mockStocks';
import type { SyntheticStockProvider } from '@/lib/stocks/types';

// TODO Phase 2: TradeXYZ / XYZ markets adapter
// TODO Phase 2: Hyperliquid HIP-3 market metadata
// TODO Phase 2: Hyperliquid-style perps execution adapter

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

let activeProvider: SyntheticStockProvider = mockProvider;

export function getSyntheticStockProvider(): SyntheticStockProvider {
  return activeProvider;
}

export function isSyntheticStocksDemoMode(): boolean {
  return !getSyntheticStockProvider().isLive;
}

export function setSyntheticStockProvider(provider: SyntheticStockProvider): void {
  activeProvider = provider;
}
