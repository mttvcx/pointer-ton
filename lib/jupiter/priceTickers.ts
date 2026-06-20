import 'server-only';

// Jupiter Price API v3. Optional JUPITER_API_KEY in production.
const JUPITER_PRICE_V3_BASE =
  process.env.JUPITER_PRICE_API_URL?.replace(/\/$/, '') ?? 'https://api.jup.ag/price/v3';

/** Wrapped / native assets Jupiter prices in USD for light tickers UI. */
export const JUPITER_TICKER_MINTS = {
  // Wormhole wrapped BTC (real BTC USD peg). Avoid 9n4nb... (mispriced / wrong feed).
  BTC: '3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh',
  // Portal (Wormhole) WETH on Solana.
  ETH: '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs',
  /** Canonical wrapped SOL pseudo-mint (chart + header SOL/USD peg). */
  SOL: 'So11111111111111111111111111111111111111112',
} as const;

const COINGECKO_TON_ID = 'the-open-network';
const COINGECKO_BNB_ID = 'binancecoin';

/** Sentinel mint for TON rows (not a Solana mint; not sent to Jupiter). */
export const TON_TICKER_MINT = 'ton-native';

/** Sentinel mint for CoinGecko BNB spot (multi-chain ticker rail). */
export const BNB_TICKER_MINT = 'bnb-native';

export type TickerQuote = {
  symbol: keyof typeof JUPITER_TICKER_MINTS | 'TON' | 'BNB';
  mint: string;
  usdPrice: number | null;
  // Percent change, e.g. 1.29 means +1.29%.
  priceChange24h: number | null;
};

type PriceRow = { usdPrice?: number; priceChange24h?: number | null };

async function fetchBtcEthSolJupiterQuotes(): Promise<TickerQuote[]> {
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
 * BNB spot in USD + 24h change via CoinGecko public API (no key required at low volume).
 */
export async function fetchBnbUsdFromCoinGecko(): Promise<{
  usdPrice: number | null;
  priceChange24h: number | null;
}> {
  const params = new URLSearchParams({
    ids: COINGECKO_BNB_ID,
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
  const row = json[COINGECKO_BNB_ID];
  const usdPrice = typeof row?.usd === 'number' && Number.isFinite(row.usd) ? row.usd : null;
  const priceChange24h =
    row?.usd_24h_change != null && Number.isFinite(row.usd_24h_change)
      ? row.usd_24h_change
      : null;
  return { usdPrice, priceChange24h };
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
  const [jupiterRows, ton, bnb] = await Promise.all([
    fetchBtcEthSolJupiterQuotes(),
    fetchTonUsdFromCoinGecko(),
    fetchBnbUsdFromCoinGecko(),
  ]);
  const tonRow: TickerQuote = {
    symbol: 'TON',
    mint: TON_TICKER_MINT,
    usdPrice: ton.usdPrice,
    priceChange24h: ton.priceChange24h,
  };
  const bnbRow: TickerQuote = {
    symbol: 'BNB',
    mint: BNB_TICKER_MINT,
    usdPrice: bnb.usdPrice,
    priceChange24h: bnb.priceChange24h,
  };
  return [...jupiterRows, tonRow, bnbRow];
}

type CachedPrice = {
  at: number;
  usdPrice: number | null;
  priceChange24h: number | null;
};

/** Last-good prices per mint — served stale when Jupiter rate-limits (429) or errors. */
const PRICE_STALE_CACHE = new Map<string, CachedPrice>();
const PRICE_STALE_TTL_MS = 10 * 60_000;

/** Jupiter Price v3 caps ids per request (~100); a whale wallet with hundreds
 * of token accounts produced one oversized URL that Jupiter rejected (400/414),
 * nulling prices for the WHOLE wallet. Chunk into <=100-id requests and merge. */
const JUPITER_PRICE_IDS_PER_REQUEST = 100;

async function fetchJupiterPriceBatch(
  uniq: string[],
): Promise<Record<string, PriceRow>> {
  const headers: HeadersInit = { Accept: 'application/json' };
  const key = process.env.JUPITER_API_KEY?.trim();
  if (key) headers['x-api-key'] = key;

  const merged: Record<string, PriceRow> = {};
  for (let i = 0; i < uniq.length; i += JUPITER_PRICE_IDS_PER_REQUEST) {
    const slice = uniq.slice(i, i + JUPITER_PRICE_IDS_PER_REQUEST);
    const url = `${JUPITER_PRICE_V3_BASE}?ids=${encodeURIComponent(slice.join(','))}`;
    const res = await fetch(url, { headers, cache: 'no-store' });
    if (!res.ok) {
      throw new Error(`jupiter_price_http_${res.status}`);
    }
    Object.assign(merged, (await res.json()) as Record<string, PriceRow>);
  }
  return merged;
}

/**
 * Spot USD price for arbitrary Solana mints (portfolio, limit-alert cron, charts).
 *
 * Resilience: one retry with backoff on 429/5xx, then last-good stale cache
 * (≤10 min) per mint, then null prices. Never throws — portfolio degrades to
 * SOL-only / `—` marks instead of a full-page failure.
 */
export async function fetchUsdPricesForMints(
  mints: string[],
): Promise<Map<string, { usdPrice: number | null; priceChange24h: number | null }>> {
  const uniq = [...new Set(mints.filter(Boolean))];
  const out = new Map<string, { usdPrice: number | null; priceChange24h: number | null }>();
  if (uniq.length === 0) return out;

  let json: Record<string, PriceRow> | null = null;
  try {
    json = await fetchJupiterPriceBatch(uniq);
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    const retryable = /jupiter_price_http_(429|5\d\d)/.test(msg) || !/jupiter_price_http_/.test(msg);
    if (retryable) {
      await new Promise((r) => setTimeout(r, 600));
      try {
        json = await fetchJupiterPriceBatch(uniq);
      } catch {
        json = null;
      }
    }
  }

  const now = Date.now();
  for (const m of uniq) {
    const row = json?.[m];
    const livePrice = typeof row?.usdPrice === 'number' && Number.isFinite(row.usdPrice)
      ? row.usdPrice
      : null;
    const liveChange =
      row?.priceChange24h != null && Number.isFinite(row.priceChange24h)
        ? row.priceChange24h
        : null;

    if (livePrice != null) {
      PRICE_STALE_CACHE.set(m, { at: now, usdPrice: livePrice, priceChange24h: liveChange });
      out.set(m, { usdPrice: livePrice, priceChange24h: liveChange });
      continue;
    }

    const stale = PRICE_STALE_CACHE.get(m);
    if (stale && now - stale.at <= PRICE_STALE_TTL_MS) {
      out.set(m, { usdPrice: stale.usdPrice, priceChange24h: stale.priceChange24h });
      continue;
    }

    out.set(m, { usdPrice: null, priceChange24h: null });
  }
  return out;
}
