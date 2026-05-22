import 'server-only';

import type { AppChainId } from '@/lib/chains/appChain';
import { inferMintKind } from '@/lib/chains/mintKind';
import type { PulseTokenBundle } from '@/types/tokens';
import type { TablesInsert } from '@/lib/supabase/types';

type DexPair = {
  priceUsd?: string | number | null;
  volume?: { h24?: number; h1?: number; m5?: number } | null;
  marketCap?: number | null;
  fdv?: number | null;
  liquidity?: { usd?: number | null } | null;
};

type DexTokenBlock = {
  chainId?: string;
  baseToken?: { address?: string };
  pairs?: DexPair[] | null;
};

const CHAIN_PATH: Partial<Record<AppChainId, string>> = {
  sol: 'solana',
  bnb: 'bsc',
  base: 'base',
};

function pickBestPair(pairs: DexPair[]): DexPair | null {
  if (pairs.length === 0) return null;
  return [...pairs].sort((a, b) => {
    const la = Number(a.liquidity?.usd) || 0;
    const lb = Number(b.liquidity?.usd) || 0;
    if (lb !== la) return lb - la;
    const va = Number(a.volume?.h24) || 0;
    const vb = Number(b.volume?.h24) || 0;
    return vb - va;
  })[0]!;
}

function pairToSnapshot(mint: string, pair: DexPair): TablesInsert<'token_market_snapshots'> {
  const priceRaw = pair.priceUsd;
  const price_usd =
    priceRaw != null && Number.isFinite(Number(priceRaw)) ? Number(priceRaw) : null;
  const mc = pair.marketCap ?? pair.fdv;
  const market_cap_usd =
    mc != null && Number.isFinite(Number(mc)) ? Number(mc) : null;
  return {
    mint,
    price_usd,
    market_cap_usd,
    liquidity_usd:
      pair.liquidity?.usd != null && Number.isFinite(Number(pair.liquidity.usd))
        ? Number(pair.liquidity.usd)
        : null,
    volume_24h_usd:
      pair.volume?.h24 != null && Number.isFinite(Number(pair.volume.h24))
        ? Number(pair.volume.h24)
        : null,
    volume_1h_usd:
      pair.volume?.h1 != null && Number.isFinite(Number(pair.volume.h1))
        ? Number(pair.volume.h1)
        : null,
    volume_5m_usd:
      pair.volume?.m5 != null && Number.isFinite(Number(pair.volume.m5))
        ? Number(pair.volume.m5)
        : null,
    snapshot_at: new Date().toISOString(),
  };
}

async function fetchDexMetricsForMints(
  chainPath: string,
  mints: string[],
): Promise<Map<string, TablesInsert<'token_market_snapshots'>>> {
  const out = new Map<string, TablesInsert<'token_market_snapshots'>>();
  if (mints.length === 0) return out;

  for (let i = 0; i < mints.length; i += 30) {
    const batch = mints.slice(i, i + 30);
    const url = `https://api.dexscreener.com/tokens/v1/${chainPath}/${batch.join(',')}`;
    try {
      const res = await fetch(url, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) continue;
      const json = (await res.json()) as DexTokenBlock[] | DexTokenBlock;
      const blocks = Array.isArray(json) ? json : [json];
      for (const block of blocks) {
        const addr = block.baseToken?.address?.trim();
        if (!addr) continue;
        const pairs = (block.pairs ?? []).filter(Boolean);
        const best = pickBestPair(pairs);
        if (!best) continue;
        out.set(addr, pairToSnapshot(addr, best));
      }
    } catch {
      /* best-effort live metrics */
    }
  }
  return out;
}

/**
 * Overlay DexScreener spot V/MC on Pulse bundles so rows tick on refetch
 * even when `token_market_snapshots` is empty in Supabase.
 */
export async function enrichPulseBundlesWithDexScreener(
  bundles: PulseTokenBundle[],
  chain: AppChainId,
): Promise<PulseTokenBundle[]> {
  const chainPath = CHAIN_PATH[chain];
  if (!chainPath || bundles.length === 0) return bundles;

  const mints = bundles
    .map((b) => b.token.mint)
    .filter((m) => {
      const kind = inferMintKind(m);
      return kind === 'sol' || kind === 'evm';
    });
  if (mints.length === 0) return bundles;

  const live = await fetchDexMetricsForMints(chainPath, mints);
  if (live.size === 0) return bundles;

  return bundles.map((bundle) => {
    const snap = live.get(bundle.token.mint);
    if (!snap) return bundle;
    return {
      ...bundle,
      snapshot: {
        id: bundle.snapshot?.id ?? -1,
        mint: bundle.token.mint,
        market_cap_usd: snap.market_cap_usd ?? bundle.snapshot?.market_cap_usd ?? null,
        liquidity_usd: snap.liquidity_usd ?? bundle.snapshot?.liquidity_usd ?? null,
        price_usd: snap.price_usd ?? bundle.snapshot?.price_usd ?? null,
        volume_5m_usd: snap.volume_5m_usd ?? bundle.snapshot?.volume_5m_usd ?? null,
        volume_1h_usd: snap.volume_1h_usd ?? bundle.snapshot?.volume_1h_usd ?? null,
        volume_24h_usd: snap.volume_24h_usd ?? bundle.snapshot?.volume_24h_usd ?? null,
        txns_5m: bundle.snapshot?.txns_5m ?? null,
        txns_1h: bundle.snapshot?.txns_1h ?? null,
        holder_count: bundle.snapshot?.holder_count ?? null,
        top10_holder_pct: bundle.snapshot?.top10_holder_pct ?? null,
        dev_holding_pct: bundle.snapshot?.dev_holding_pct ?? null,
        extended_metrics: bundle.snapshot?.extended_metrics ?? null,
        snapshot_at: snap.snapshot_at ?? new Date().toISOString(),
      },
    };
  });
}
