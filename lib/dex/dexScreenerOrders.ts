import { withTimeout } from '@/lib/utils/withTimeout';

/**
 * Free public DexScreener endpoint that reports any paid orders a token has
 * (tokenProfile, communityTakeover, tokenAd, trendingBarAd). It returns an
 * array even for unpaid tokens — empty array means "no paid orders".
 *
 * Rate limit: 60 req/min.
 * Docs: https://docs.dexscreener.com/api/reference
 */
export type DexScreenerOrderType =
  | 'tokenProfile'
  | 'communityTakeover'
  | 'tokenAd'
  | 'trendingBarAd';

export type DexScreenerOrderStatus = 'processing' | 'cancelled' | 'on-hold' | 'approved' | 'rejected';

export interface DexScreenerOrder {
  type: DexScreenerOrderType;
  status: DexScreenerOrderStatus;
  paymentTimestamp: number;
}

const ORDER_TIMEOUT_MS = 6_000;

/**
 * Fetches all paid DexScreener orders for a single token. Returns `null` on
 * any network / parse / timeout error so callers can fall back to `—`.
 */
export async function fetchDexScreenerOrdersForToken(
  mint: string,
): Promise<DexScreenerOrder[] | null> {
  const url = `https://api.dexscreener.com/orders/v1/solana/${encodeURIComponent(mint)}`;
  try {
    const res = await withTimeout(
      fetch(url, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      }),
      ORDER_TIMEOUT_MS,
      'dexscreener_orders',
    );
    if (!res.ok) return null;
    const json: unknown = await res.json();
    if (!Array.isArray(json)) return null;
    const out: DexScreenerOrder[] = [];
    for (const raw of json) {
      if (!raw || typeof raw !== 'object') continue;
      const r = raw as Record<string, unknown>;
      const type = r.type;
      const status = r.status;
      const paymentTimestamp = r.paymentTimestamp;
      if (
        (type === 'tokenProfile' ||
          type === 'communityTakeover' ||
          type === 'tokenAd' ||
          type === 'trendingBarAd') &&
        (status === 'processing' ||
          status === 'cancelled' ||
          status === 'on-hold' ||
          status === 'approved' ||
          status === 'rejected') &&
        typeof paymentTimestamp === 'number'
      ) {
        out.push({ type, status, paymentTimestamp });
      }
    }
    return out;
  } catch {
    return null;
  }
}

/**
 * Convenience: returns `true` if the token has any approved DexScreener order
 * (the surface the founder cares about for "Dex Paid" pill). `null` means
 * "unknown" — the request failed or the token simply isn't on DexScreener.
 */
export async function fetchDexScreenerPaidFlag(mint: string): Promise<boolean | null> {
  const orders = await fetchDexScreenerOrdersForToken(mint);
  if (orders == null) return null;
  return orders.some((o) => o.status === 'approved');
}
