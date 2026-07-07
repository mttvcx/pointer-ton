import 'server-only';

import type { AppChainId } from '@/lib/chains/appChain';
import type { TrackerTradeRow } from '@/lib/db/trackerTrades';

/**
 * EVM tracked-wallet trades — powered by Moralis (the EVM counterpart to the
 * Solana Helius→mint_swaps pipeline). The Solana feed reads a pre-indexed table;
 * there's no EVM index, so we fetch DEX swaps per tracked wallet on demand and
 * merge, matching the app's on-demand-bounded-fetch principle.
 *
 * CU budget: Moralis free tier is 40K CU/day, and there's no multi-wallet batch
 * endpoint, so we (a) cap the wallets fetched per refresh, (b) cache the merged
 * result briefly so the client's poll mostly hits cache.
 */

const MORALIS_BASE = 'https://deep-index.moralis.io/api/v2.2';
/** Cap wallets fetched per refresh — bounds Moralis CU on a live poll. */
const MAX_WALLETS = 14;
/** Swaps pulled per wallet (newest first). */
const PER_WALLET = 5;
const CACHE_TTL_MS = 20_000;

/** app chain → Moralis chain slug. */
const MORALIS_CHAIN: Record<'eth' | 'bnb' | 'base', string> = { eth: 'eth', bnb: 'bsc', base: 'base' };

export function evmTradesConfigured(): boolean {
  return Boolean(process.env.MORALIS_API_KEY?.trim());
}

type MoralisSide = { address?: string; symbol?: string; name?: string; logo?: string | null };
type MoralisSwap = {
  transactionHash?: string;
  transactionType?: string; // 'buy' | 'sell'
  walletAddress?: string;
  blockTimestamp?: string;
  totalValueUsd?: number | string | null;
  bought?: MoralisSide;
  sold?: MoralisSide;
};

const num = (v: unknown): number | null =>
  v == null || Number.isNaN(Number(v)) ? null : Number(v);

const cache = new Map<string, { at: number; rows: TrackerTradeRow[] }>();

async function fetchWalletSwaps(
  address: string,
  label: string | null,
  chainSlug: string,
  apiKey: string,
): Promise<TrackerTradeRow[]> {
  try {
    const url = `${MORALIS_BASE}/wallets/${address}/swaps?chain=${chainSlug}&limit=${PER_WALLET}&order=DESC`;
    const res = await fetch(url, {
      headers: { 'X-API-Key': apiKey, accept: 'application/json' },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { result?: MoralisSwap[] };
    const rows = json.result ?? [];
    return rows
      .map((r): TrackerTradeRow | null => {
        const side: 'buy' | 'sell' = r.transactionType === 'sell' ? 'sell' : 'buy';
        // The traded (memecoin) side: what you received on a buy, what you gave on a sell.
        const traded = side === 'buy' ? r.bought : r.sold;
        if (!r.transactionHash || !traded?.address) return null;
        return {
          signature: r.transactionHash,
          wallet: r.walletAddress ?? address,
          walletLabel: label,
          mint: traded.address,
          symbol: traded.symbol ?? null,
          name: traded.name ?? null,
          imageUrl: traded.logo ?? null,
          side,
          solAmount: null, // EVM: native amount omitted; USD is the source of truth
          usdAmount: r.totalValueUsd != null ? Math.abs(Number(r.totalValueUsd)) : null,
          marketCapUsd: null,
          blockTime: r.blockTimestamp ?? null,
        };
      })
      .filter((x): x is TrackerTradeRow => x != null);
  } catch {
    return [];
  }
}

export async function listEvmTrackedWalletTrades(
  wallets: { address: string; label: string | null }[],
  chain: Extract<AppChainId, 'eth' | 'bnb' | 'base'>,
  limit = 40,
): Promise<TrackerTradeRow[]> {
  const apiKey = process.env.MORALIS_API_KEY?.trim();
  if (!apiKey || wallets.length === 0) return [];

  const chainSlug = MORALIS_CHAIN[chain];
  const scoped = wallets.slice(0, MAX_WALLETS);
  const cacheKey = `${chain}:${scoped.map((w) => w.address).sort().join(',')}`;

  const hit = cache.get(cacheKey);
  const now = Date.now();
  if (hit && now - hit.at < CACHE_TTL_MS) return hit.rows.slice(0, limit);

  const perWallet = await Promise.all(
    scoped.map((w) => fetchWalletSwaps(w.address.toLowerCase(), w.label, chainSlug, apiKey)),
  );

  const merged = perWallet.flat();
  merged.sort((a, b) => (num(b.blockTime ? Date.parse(b.blockTime) : 0) ?? 0) - (num(a.blockTime ? Date.parse(a.blockTime) : 0) ?? 0));

  const seen = new Set<string>();
  const deduped: TrackerTradeRow[] = [];
  for (const r of merged) {
    const key = `${r.signature}:${r.side}:${r.wallet}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(r);
  }

  cache.set(cacheKey, { at: now, rows: deduped });
  return deduped.slice(0, limit);
}
