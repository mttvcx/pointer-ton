import 'server-only';

// Jupiter Price API v3. Optional JUPITER_API_KEY in production.
const JUPITER_PRICE_V3_BASE =
  process.env.JUPITER_PRICE_API_URL?.replace(/\/$/, '') ?? 'https://api.jup.ag/price/v3';

import { HYPE_MINT } from '@/lib/utils/constants';

export const TICKER_MINTS = {
  SOL: 'So11111111111111111111111111111111111111112',
  // Wormhole wrapped BTC (real BTC USD peg). Avoid 9n4nb... (mispriced / wrong feed).
  BTC: '3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh',
  // Portal (Wormhole) WETH on Solana.
  ETH: '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs',
  HYPE: HYPE_MINT,
} as const;

export type TickerSymbol = keyof typeof TICKER_MINTS;

export type TickerQuote = {
  symbol: TickerSymbol;
  mint: string;
  usdPrice: number | null;
  // Percent change, e.g. 1.29 means +1.29%.
  priceChange24h: number | null;
};

type PriceRow = { usdPrice?: number; priceChange24h?: number | null };

export async function fetchJupiterTickerQuotes(): Promise<TickerQuote[]> {
  const ids = Object.values(TICKER_MINTS);
  const url = `${JUPITER_PRICE_V3_BASE}?ids=${encodeURIComponent(ids.join(','))}`;
  const headers: HeadersInit = { Accept: 'application/json' };
  const key = process.env.JUPITER_API_KEY?.trim();
  if (key) headers['x-api-key'] = key;

  const res = await fetch(url, { headers, cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`jupiter_price_http_${res.status}`);
  }

  const json = (await res.json()) as Record<string, PriceRow>;

  return (Object.keys(TICKER_MINTS) as TickerSymbol[]).map((symbol) => {
    const mint = TICKER_MINTS[symbol];
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
  });
}

/** Spot USD price for arbitrary mints (e.g. limit-alert cron, charts). */
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
