import 'server-only';

// Jupiter Price API v3. Optional JUPITER_API_KEY in production.
const JUPITER_PRICE_V3_BASE =
  process.env.JUPITER_PRICE_API_URL?.replace(/\/$/, '') ?? 'https://api.jup.ag/price/v3';

/** Wrapped assets on Solana Jupiter still prices BTC/ETH in USD accurately enough for a header ticker. */
export const JUPITER_TICKER_MINTS = {
  // Wormhole wrapped BTC (real BTC USD peg). Avoid 9n4nb... (mispriced / wrong feed).
  BTC: '3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh',
  // Portal (Wormhole) WETH on Solana.
  ETH: '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs',
} as const;

const COINGECKO_TON_ID = 'the-open-network';

/** Sentinel mint for TON rows (not a Solana mint; not sent to Jupiter). */
export const TON_TICKER_MINT = 'ton-native';

export type TickerQuote = {
  symbol: 'BTC' | 'ETH' | 'TON';
  mint: string;
  usdPrice: number | null;
  // Percent change, e.g. 1.29 means +1.29%.
  priceChange24h: number | null;
};

type PriceRow = { usdPrice?: number; priceChange24h?: number | null };

async function fetchBtcEthJupiterQuotes(): Promise<TickerQuote[]> {
  const ids = Object.values(JUPITER_TICKER_MINTS);
  const url = `${JUPITER_PRICE_V3_BASE}?ids=${encodeURIComponent(ids.join(','))}`;
  const headers: HeadersInit = { Accept: 'application/json' };
  const key = process.env.JUPITER_API_KEY?.trim();
  if (key) headers['x-api-key'] = key;

  const res = await fetch(url, { headers, cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`jupiter_price_http_${res.status}`);
  }

  const json = (await res.json()) as Record<string, PriceRow>;

  return (Object.keys(JUPITER_TICKER_MINTS) as (keyof typeof JUPITER_TICKER_MINTS)[]).map(
    (symbol) => {
      const mint = JUPITER_TICKER_MINTS[symbol];
      const row = json[mint];
      return {
        symbol,
        mint,
        usdPrice: typeof row?.usdPrice === 'number' ? row.usdPrice : null,
        priceChange24h:
          row?.priceChange24h != null && Number.isFinite(row.priceChange24h)
            ? row.priceChange24h
            : null,
      };
    },
  );
}

/**
 * TON spot in USD + 24h change via CoinGecko public API (no key required at low volume).
 */
export async function fetchTonUsdFromCoinGecko(): Promise<{
  usdPrice: number | null;
  priceChange24h: number | null;
}> {
  const params = new URLSearchParams({
    ids: COINGECKO_TON_ID,
    vs_currencies: 'usd',
    include_24hr_change: 'true',
  });
  const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?${params}`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) {
    return { usdPrice: null, priceChange24h: null };
  }
  const json = (await res.json()) as Record<
    string,
    { usd?: number; usd_24h_change?: number } | undefined
  >;
  const row = json[COINGECKO_TON_ID];
  const usdPrice = typeof row?.usd === 'number' && Number.isFinite(row.usd) ? row.usd : null;
  const priceChange24h =
    row?.usd_24h_change != null && Number.isFinite(row.usd_24h_change)
      ? row.usd_24h_change
      : null;
  return { usdPrice, priceChange24h };
}

export async function fetchJupiterTickerQuotes(): Promise<TickerQuote[]> {
  const [btcEth, ton] = await Promise.all([fetchBtcEthJupiterQuotes(), fetchTonUsdFromCoinGecko()]);
  const tonRow: TickerQuote = {
    symbol: 'TON',
    mint: TON_TICKER_MINT,
    usdPrice: ton.usdPrice,
    priceChange24h: ton.priceChange24h,
  };
  return [...btcEth, tonRow];
}

/** Spot USD price for arbitrary Solana mints (e.g. limit-alert cron, charts). */
export async function fetchUsdPricesForMints(
  mints: string[],
): Promise<Map<string, { usdPrice: number | null; priceChange24h: number | null }>> {
  const uniq = [...new Set(mints.filter(Boolean))];
  const out = new Map<string, { usdPrice: number | null; priceChange24h: number | null }>();
  if (uniq.length === 0) return out;

  const url = `${JUPITER_PRICE_V3_BASE}?ids=${encodeURIComponent(uniq.join(','))}`;
  const headers: HeadersInit = { Accept: 'application/json' };
  const key = process.env.JUPITER_API_KEY?.trim();
  if (key) headers['x-api-key'] = key;

  const res = await fetch(url, { headers, cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`jupiter_price_http_${res.status}`);
  }

  const json = (await res.json()) as Record<string, PriceRow>;
  for (const m of uniq) {
    const row = json[m];
    out.set(m, {
      usdPrice: typeof row?.usdPrice === 'number' ? row.usdPrice : null,
      priceChange24h:
        row?.priceChange24h != null && Number.isFinite(row.priceChange24h)
          ? row.priceChange24h
          : null,
    });
  }
  return out;
}
