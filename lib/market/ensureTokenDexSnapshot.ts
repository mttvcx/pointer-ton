import 'server-only';

import type { AppChainId } from '@/lib/chains/appChain';
import {
  getLatestSnapshotForMint,
  getTokenByMint,
  insertMarketSnapshot,
  updateToken,
  type TokenMarketSnapshotRow,
} from '@/lib/db/tokens';
import { fetchDexMetricsForMints } from '@/lib/market/dexscreenerPulse';
import { isLikelyPumpFunMint } from '@/lib/market/pumpFunCoin';
import type { Json } from '@/lib/supabase/types';

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
  const ext = snap.extended_metrics;
  const hasQuote =
    ext != null &&
    typeof ext === 'object' &&
    !Array.isArray(ext) &&
    (typeof (ext as Record<string, unknown>).quoteSymbol === 'string' ||
      typeof (ext as Record<string, unknown>).quoteMint === 'string');
  if (!hasQuote) return true;
  const age = Date.now() - new Date(snap.snapshot_at).getTime();
  return !Number.isFinite(age) || age > STALE_MS;
}

function mergeExtendedMetrics(
  prev: Json | null | undefined,
  next: Record<string, unknown>,
): Json {
  const base =
    prev && typeof prev === 'object' && !Array.isArray(prev)
      ? { ...(prev as Record<string, unknown>) }
      : ({} as Record<string, unknown>);
  return { ...base, ...next } as Json;
}

async function patchTokenFromDexPairMeta(mint: string, pairMeta: Record<string, unknown>): Promise<void> {
  const token = await getTokenByMint(mint);
  if (!token) return;

  const dexMigrated = pairMeta.dexMigrated === true;
  const dexId = typeof pairMeta.dexId === 'string' ? pairMeta.dexId.toLowerCase() : '';
  const patch: Parameters<typeof updateToken>[1] = {};

  if (!token.launch_pad?.trim() && isLikelyPumpFunMint(mint, null)) {
    patch.launch_pad = 'pump.fun';
  }
  if (
    dexMigrated &&
    !token.migrated_at &&
    (isLikelyPumpFunMint(mint, token.launch_pad) || dexId === 'pumpswap')
  ) {
    patch.migrated_at = new Date().toISOString();
    patch.bonding_progress = 100;
  }

  if (Object.keys(patch).length === 0) return;
  await updateToken(mint, patch);
}

/**
 * Ensure a recent DexScreener market snapshot exists for desk header (price / MC / liq / pair quote).
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

    const pairMeta =
      snap.extended_metrics && typeof snap.extended_metrics === 'object' && !Array.isArray(snap.extended_metrics)
        ? (snap.extended_metrics as Record<string, unknown>)
        : {};

    await patchTokenFromDexPairMeta(mint, pairMeta);

    const merged: typeof snap = {
      ...snap,
      extended_metrics: mergeExtendedMetrics(existing?.extended_metrics, pairMeta),
    };
    await insertMarketSnapshot(merged);
    return (await getLatestSnapshotForMint(mint)) ?? existing;
  } catch {
    return existing;
  }
}
