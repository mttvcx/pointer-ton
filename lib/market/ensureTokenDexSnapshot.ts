import 'server-only';

import type { AppChainId } from '@/lib/chains/appChain';
import {
  getLatestSnapshotForMint,
  insertMarketSnapshot,
  type TokenMarketSnapshotRow,
} from '@/lib/db/tokens';
import { fetchDexMetricsForMints } from '@/lib/market/dexscreenerPulse';

const CHAIN_PATH: Partial<Record<AppChainId, string>> = {
  sol: 'solana',
  eth: 'ethereum',
  bnb: 'bsc',
  base: 'base',
};

const STALE_MS = 5 * 60_000;

function snapshotNeedsRefresh(snap: TokenMarketSnapshotRow | null): boolean {
  if (!snap) return true;
  if (snap.price_usd == null || !Number.isFinite(Number(snap.price_usd))) return true;
  const age = Date.now() - new Date(snap.snapshot_at).getTime();
  return !Number.isFinite(age) || age > STALE_MS;
}

/**
 * Ensure a recent DexScreener market snapshot exists for desk header (price / MC / liq).
 */
export async function ensureTokenDexSnapshot(
  mint: string,
  chain: AppChainId = 'sol',
): Promise<TokenMarketSnapshotRow | null> {
  const existing = await getLatestSnapshotForMint(mint);
  if (!snapshotNeedsRefresh(existing)) return existing;

  const chainPath = CHAIN_PATH[chain];
  if (!chainPath) return existing;

  try {
    const metrics = await fetchDexMetricsForMints(chainPath, [mint]);
    const snap = metrics.get(mint);
    if (!snap) return existing;
    await insertMarketSnapshot(snap);
    return (await getLatestSnapshotForMint(mint)) ?? existing;
  } catch {
    return existing;
  }
}
