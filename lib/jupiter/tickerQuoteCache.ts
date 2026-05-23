import 'server-only';

import {
  fetchJupiterTickerQuotes,
  type TickerQuote,
} from '@/lib/jupiter/priceTickers';

const TICKER_CACHE_MS = 20_000;

let cache: { at: number; data: TickerQuote[] } | null = null;
let inflight: Promise<TickerQuote[]> | null = null;

/** Shared in-process cache so every tab/client poll doesn't hit Jupiter + CoinGecko. */
export async function getCachedJupiterTickerQuotes(): Promise<TickerQuote[]> {
  const now = Date.now();
  if (cache && now - cache.at < TICKER_CACHE_MS) {
    return cache.data;
  }

  if (!inflight) {
    inflight = fetchJupiterTickerQuotes()
      .then((data) => {
        cache = { at: Date.now(), data };
        return data;
      })
      .finally(() => {
        inflight = null;
      });
  }

  return inflight;
}
