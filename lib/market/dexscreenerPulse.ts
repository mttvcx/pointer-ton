import 'server-only';

import type { AppChainId } from '@/lib/chains/appChain';
import { inferMintKind } from '@/lib/chains/mintKind';
import type { PulseTokenBundle } from '@/types/tokens';
import type { TablesInsert } from '@/lib/supabase/types';

/** One DexScreener pair row — `/tokens/v1/{chain}/{addrs}` returns a flat array of these. */
type DexPairRow = {
  chainId?: string;
  dexId?: string;
  baseToken?: { address?: string };
  quoteToken?: { address?: string };
  priceUsd?: string | number | null;
  volume?: { h24?: number; h1?: number; m5?: number } | null;
  marketCap?: number | null;
  fdv?: number | null;
  liquidity?: { usd?: number | null } | null;
  txns?: {
    m5?: { buys?: number; sells?: number } | null;
    h1?: { buys?: number; sells?: number } | null;
    h24?: { buys?: number; sells?: number } | null;
  } | null;
};

const CHAIN_PATH: Partial<Record<AppChainId, string>> = {
  sol: 'solana',
  bnb: 'bsc',
  base: 'base',
};

function pickBestPair(pairs: DexPairRow[]): DexPairRow | null {
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

function txnCount(
  txns: DexPairRow['txns'],
  window: 'm5' | 'h1' | 'h24',
): number | null {
  const bucket = txns?.[window];
  if (!bucket) return null;
  const buys = Number(bucket.buys) || 0;
  const sells = Number(bucket.sells) || 0;
  const total = buys + sells;
  return total > 0 ? total : null;
}

function pairToSnapshot(mint: string, pair: DexPairRow): TablesInsert<'token_market_snapshots'> {
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
    txns_5m: txnCount(pair.txns, 'm5'),
    txns_1h: txnCount(pair.txns, 'h1'),
    snapshot_at: new Date().toISOString(),
  };
}

function groupPairsByMint(rows: DexPairRow[], mintSet: Set<string>): Map<string, DexPairRow[]> {
  const grouped = new Map<string, DexPairRow[]>();
  for (const row of rows) {
    const base = row.baseToken?.address?.trim();
    if (base && mintSet.has(base)) {
      const list = grouped.get(base) ?? [];
      list.push(row);
      grouped.set(base, list);
    }
  }
  return grouped;
}

async function fetchDexMetricsForMints(
  chainPath: string,
  mints: string[],
): Promise<Map<string, TablesInsert<'token_market_snapshots'>>> {
  const out = new Map<string, TablesInsert<'token_market_snapshots'>>();
  if (mints.length === 0) return out;

  const mintSet = new Set(mints);

  for (let i = 0; i < mints.length; i += 30) {
    const batch = mints.slice(i, i + 30);
    const url = `https://api.dexscreener.com/tokens/v1/${chainPath}/${batch.join(',')}`;
    try {
      const res = await fetch(url, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(5_000),
      });
      if (!res.ok) continue;
      const json = (await res.json()) as DexPairRow[] | DexPairRow | { pairs?: DexPairRow[] };
      let rows: DexPairRow[] = [];
      if (Array.isArray(json)) {
        rows = json;
      } else if (json && typeof json === 'object' && Array.isArray((json as { pairs?: DexPairRow[] }).pairs)) {
        rows = (json as { pairs: DexPairRow[] }).pairs;
      } else if (json && typeof json === 'object') {
        rows = [json as DexPairRow];
      }

      const grouped = groupPairsByMint(rows, mintSet);
      for (const [mint, pairs] of grouped) {
        const best = pickBestPair(pairs);
        if (!best) continue;
        out.set(mint, pairToSnapshot(mint, best));
      }
    } catch {
      /* best-effort live metrics */
    }
  }
  return out;
}

/** Fetch best-effort spot USD for a single mint (DexScreener). */
export async function fetchDexScreenerSpotUsd(
  mint: string,
  chain: AppChainId = 'sol',
): Promise<number | null> {
  const chainPath = CHAIN_PATH[chain];
  if (!chainPath) return null;
  const live = await fetchDexMetricsForMints(chainPath, [mint]);
  const snap = live.get(mint);
  const px = snap?.price_usd;
  return px != null && Number.isFinite(px) && px > 0 ? px : null;
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
        txns_5m: snap.txns_5m ?? bundle.snapshot?.txns_5m ?? null,
        txns_1h: snap.txns_1h ?? bundle.snapshot?.txns_1h ?? null,
        holder_count: bundle.snapshot?.holder_count ?? null,
        top10_holder_pct: bundle.snapshot?.top10_holder_pct ?? null,
        dev_holding_pct: bundle.snapshot?.dev_holding_pct ?? null,
        extended_metrics: bundle.snapshot?.extended_metrics ?? null,
        snapshot_at: snap.snapshot_at ?? new Date().toISOString(),
      },
    };
  });
}
