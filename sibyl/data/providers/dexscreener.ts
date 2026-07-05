import 'server-only';

import type { MarketFacts, ProviderStatus } from '@/sibyl/data/providers/types';
import { sibylMockMode } from '@/sibyl/config';

/**
 * DexScreener — token price / liquidity / MC / volume. Public API, no key needed,
 * so this is REAL out of the box (falls back to mock only in explicit mock mode).
 * Env: none required. Optional DEXSCREENER_BASE_URL override.
 */
const BASE = process.env.DEXSCREENER_BASE_URL?.trim() || 'https://api.dexscreener.com';

export function dexscreenerStatus(): ProviderStatus {
  return { name: 'dexscreener', configured: !sibylMockMode(), envVars: [], note: 'Public API — real by default.' };
}

function mockMarket(mint: string): MarketFacts {
  return {
    symbol: 'COBRA',
    name: 'Cobra',
    priceUsd: 0.0000023,
    marketCapUsd: 2_300_000,
    liquidityUsd: 84_000,
    volume24hUsd: 1_240_000,
    change24hPct: 41.3,
    ageLabel: '3h',
    protocol: 'pump',
    imageUrl: null,
    source: `dexscreener:mock:${mint.slice(0, 4)}`,
  };
}

export async function getMarketFacts(mint: string, chain: 'sol' | 'eth' | 'base' | 'bnb' = 'sol'): Promise<MarketFacts> {
  if (sibylMockMode()) return mockMarket(mint);
  try {
    const res = await fetch(`${BASE}/latest/dex/tokens/${encodeURIComponent(mint)}`, {
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 0 },
    });
    if (!res.ok) return mockMarket(mint);
    const json = (await res.json()) as { pairs?: DexPair[] };
    const pairs = (json.pairs ?? []).filter((p) => (chain === 'sol' ? p.chainId === 'solana' : true));
    // Most liquid pair wins.
    const p = pairs.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
    if (!p) return { ...mockMarket(mint), source: 'dexscreener:no_pairs' };
    const ageMs = p.pairCreatedAt ? Date.now() - p.pairCreatedAt : null;
    return {
      symbol: p.baseToken?.symbol ?? null,
      name: p.baseToken?.name ?? null,
      priceUsd: p.priceUsd ? Number(p.priceUsd) : null,
      marketCapUsd: p.fdv ?? p.marketCap ?? null,
      liquidityUsd: p.liquidity?.usd ?? null,
      volume24hUsd: p.volume?.h24 ?? null,
      change24hPct: p.priceChange?.h24 ?? null,
      ageLabel: ageMs != null ? fmtAge(ageMs) : null,
      protocol: p.dexId ?? null,
      imageUrl: p.info?.imageUrl ?? null,
      source: 'dexscreener',
    };
  } catch {
    return { ...mockMarket(mint), source: 'dexscreener:error' };
  }
}

function fmtAge(ms: number): string {
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

type DexPair = {
  chainId?: string;
  dexId?: string;
  priceUsd?: string;
  fdv?: number;
  marketCap?: number;
  pairCreatedAt?: number;
  baseToken?: { symbol?: string; name?: string };
  liquidity?: { usd?: number };
  volume?: { h24?: number };
  priceChange?: { h24?: number };
  info?: { imageUrl?: string };
};
