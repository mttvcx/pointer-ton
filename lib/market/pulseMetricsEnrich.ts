import 'server-only';

import type { AppChainId } from '@/lib/chains/appChain';
import { inferMintKind } from '@/lib/chains/mintKind';
import { insertMarketSnapshot, updateToken, getTokenByMint, listTokensByCreatorWallet } from '@/lib/db/tokens';
import { resolveTokenHolders } from '@/lib/onchain/resolveTokenHolders';
import { countProTraders } from '@/lib/onchain/countProTraders';
import {
  fetchPumpFunCoin,
  isLikelyPumpFunMint,
  type PumpFunCoinRow,
} from '@/lib/market/pumpFunCoin';
import { withTimeout } from '@/lib/utils/withTimeout';
import { isPointerQaMint, pointerQaMintOnly } from '@/lib/qa/pointerQaMint';
import type { PulseTokenBundle } from '@/types/tokens';
import type { TablesInsert } from '@/lib/supabase/types';
import type { Json } from '@/lib/supabase/types';

const MAX_HOLDER_ENRICH = 28;
const MAX_PUMP_META_ENRICH = 20;
const HOLDER_POOL = 6;
const PUMP_POOL = 8;

async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  async function worker() {
    for (;;) {
      const ix = i++;
      if (ix >= items.length) return;
      out[ix] = await fn(items[ix]!);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return out;
}

function snapshotBase(bundle: PulseTokenBundle) {
  const mint = bundle.token.mint;
  const prev = bundle.snapshot;
  return {
    id: prev?.id ?? -1,
    mint,
    market_cap_usd: prev?.market_cap_usd ?? null,
    liquidity_usd: prev?.liquidity_usd ?? null,
    price_usd: prev?.price_usd ?? null,
    volume_5m_usd: prev?.volume_5m_usd ?? null,
    volume_1h_usd: prev?.volume_1h_usd ?? null,
    volume_24h_usd: prev?.volume_24h_usd ?? null,
    txns_5m: prev?.txns_5m ?? null,
    txns_1h: prev?.txns_1h ?? null,
    holder_count: prev?.holder_count ?? null,
    top10_holder_pct: prev?.top10_holder_pct ?? null,
    dev_holding_pct: prev?.dev_holding_pct ?? null,
    extended_metrics: prev?.extended_metrics ?? null,
    snapshot_at: prev?.snapshot_at ?? new Date().toISOString(),
  };
}

function bundleMissingHolderMetrics(bundle: PulseTokenBundle): boolean {
  const s = bundle.snapshot;
  if (!s) return true;
  return (
    s.top10_holder_pct == null ||
    s.dev_holding_pct == null ||
    s.holder_count == null
  );
}

function bundleMissingPumpMeta(bundle: PulseTokenBundle): boolean {
  const t = bundle.token;
  if (!isLikelyPumpFunMint(t.mint, t.launch_pad)) return false;
  return (
    !t.twitter_handle?.trim() ||
    !t.creator_wallet?.trim() ||
    !t.migrated_at ||
    (!t.website_url?.trim() && !t.telegram_url?.trim())
  );
}

function mergePumpIntoToken(
  bundle: PulseTokenBundle,
  pump: PumpFunCoinRow,
): PulseTokenBundle['token'] {
  const t = bundle.token;
  return {
    ...t,
    name: t.name?.trim() ? t.name : pump.name ?? t.name,
    symbol: t.symbol?.trim() ? t.symbol : pump.symbol ?? t.symbol,
    image_url: t.image_url?.trim() ? t.image_url : pump.image_uri ?? t.image_url,
    twitter_handle: t.twitter_handle?.trim() ? t.twitter_handle : pump.twitter ?? t.twitter_handle,
    telegram_url: t.telegram_url?.trim() ? t.telegram_url : pump.telegram ?? t.telegram_url,
    website_url: t.website_url?.trim() ? t.website_url : pump.website ?? t.website_url,
    creator_wallet: t.creator_wallet?.trim() ? t.creator_wallet : pump.creator ?? t.creator_wallet,
    launch_pad: t.launch_pad?.trim() ? t.launch_pad : 'pump.fun',
    migrated_at:
      t.migrated_at ??
      (pump.complete ? new Date().toISOString() : t.migrated_at),
    bonding_progress:
      pump.complete && t.bonding_progress == null ? 100 : t.bonding_progress,
  };
}

function bundleMissingStripMetrics(bundle: PulseTokenBundle): boolean {
  const ext = bundle.snapshot?.extended_metrics;
  if (!ext || typeof ext !== 'object' || Array.isArray(ext)) return true;
  const r = ext as Record<string, unknown>;
  return r.pro_traders == null && r.dev_deploy_total == null && r.dev_deploy_migrated == null;
}

async function devDeployStatsForCreator(
  creatorWallet: string,
): Promise<{ migrated: number; total: number } | null> {
  try {
    const rows = await listTokensByCreatorWallet(creatorWallet, 80);
    if (rows.length === 0) return null;
    const migrated = rows.filter((t) => t.migrated_at != null).length;
    return { migrated, total: rows.length };
  } catch {
    return null;
  }
}

function mergeHolderMetrics(
  bundle: PulseTokenBundle,
  resolved: Awaited<ReturnType<typeof resolveTokenHolders>>,
  extras?: {
    proTraders?: number | null;
    devDeploy?: { migrated: number; total: number } | null;
  },
): PulseTokenBundle {
  if (!resolved && !extras?.proTraders && !extras?.devDeploy) return bundle;
  const base = snapshotBase(bundle);
  const ext =
    base.extended_metrics && typeof base.extended_metrics === 'object' && !Array.isArray(base.extended_metrics)
      ? { ...(base.extended_metrics as Record<string, unknown>) }
      : ({} as Record<string, unknown>);

  if (resolved) {
    let sniperPct = 0;
    for (const h of resolved.holders) {
      if (h.is_sniper && h.pct_of_supply != null) sniperPct += h.pct_of_supply;
    }
    if (sniperPct > 0) ext.sniperHolderPct = sniperPct;
  }

  if (extras?.proTraders != null && extras.proTraders >= 0) {
    ext.pro_traders = extras.proTraders;
  }
  if (extras?.devDeploy) {
    ext.dev_deploy_migrated = extras.devDeploy.migrated;
    ext.dev_deploy_total = extras.devDeploy.total;
  }

  return {
    ...bundle,
    snapshot: {
      ...base,
      holder_count: resolved?.holderCountTotal ?? base.holder_count,
      top10_holder_pct: resolved?.top10HolderPct ?? base.top10_holder_pct,
      dev_holding_pct: resolved?.devHoldingPct ?? base.dev_holding_pct,
      extended_metrics: (Object.keys(ext).length > 0 ? ext : base.extended_metrics) as Json,
      snapshot_at: new Date().toISOString(),
    },
  };
}

function persistMetricsAsync(bundle: PulseTokenBundle, tokenDirty: boolean) {
  void (async () => {
    try {
      const snap = bundle.snapshot;
      if (snap) {
        const row: TablesInsert<'token_market_snapshots'> = {
          mint: snap.mint,
          market_cap_usd: snap.market_cap_usd,
          liquidity_usd: snap.liquidity_usd,
          price_usd: snap.price_usd,
          volume_5m_usd: snap.volume_5m_usd,
          volume_1h_usd: snap.volume_1h_usd,
          volume_24h_usd: snap.volume_24h_usd,
          txns_5m: snap.txns_5m,
          txns_1h: snap.txns_1h,
          holder_count: snap.holder_count,
          top10_holder_pct: snap.top10_holder_pct,
          dev_holding_pct: snap.dev_holding_pct,
          extended_metrics: snap.extended_metrics,
          snapshot_at: snap.snapshot_at,
        };
        await insertMarketSnapshot(row);
      }
      if (tokenDirty) {
        const t = bundle.token;
        await updateToken(t.mint, {
          twitter_handle: t.twitter_handle,
          telegram_url: t.telegram_url,
          website_url: t.website_url,
          creator_wallet: t.creator_wallet,
          name: t.name,
          symbol: t.symbol,
          image_url: t.image_url,
        });
      }
    } catch {
      /* best-effort cache warm */
    }
  })();
}

/**
 * Live holder + pump.fun metadata for Pulse rows — fills top/bottom metric strips
 * that would otherwise show em-dashes when DB snapshots are price-only.
 */
export async function enrichPulseBundlesWithMetrics(
  bundles: PulseTokenBundle[],
  chain: AppChainId,
): Promise<PulseTokenBundle[]> {
  if (bundles.length === 0 || chain !== 'sol') return bundles;

  const byMint = new Map(bundles.map((b) => [b.token.mint, b]));

  const holderTargets = bundles
    .filter((b) => {
      if (pointerQaMintOnly() && !isPointerQaMint(b.token.mint)) return false;
      return (
        inferMintKind(b.token.mint) === 'sol' &&
        (bundleMissingHolderMetrics(b) || bundleMissingStripMetrics(b))
      );
    })
    .slice(0, MAX_HOLDER_ENRICH);

  const pumpTargets = bundles
    .filter((b) => {
      if (pointerQaMintOnly() && !isPointerQaMint(b.token.mint)) return false;
      return bundleMissingPumpMeta(b);
    })
    .slice(0, MAX_PUMP_META_ENRICH);

  const [holderResults, pumpResults] = await Promise.all([
    mapPool(holderTargets, HOLDER_POOL, async (bundle) => {
      try {
        const needsHolders = bundleMissingHolderMetrics(bundle);
        const needsStrip = bundleMissingStripMetrics(bundle);
        const resolved = needsHolders || needsStrip
          ? await withTimeout(
              resolveTokenHolders(bundle.token.mint, {
                limit: 20,
                forceLive: bundle.token.created_at
                  ? Date.now() - new Date(bundle.token.created_at).getTime() < 30 * 60_000
                  : false,
              }),
              8_000,
              'pulse_holder_enrich',
            )
          : null;

        let proTraders: number | null = null;
        if (needsStrip && resolved?.holders.length) {
          proTraders = await countProTraders(resolved.holders);
        }

        let devDeploy: { migrated: number; total: number } | null = null;
        const creator = bundle.token.creator_wallet?.trim();
        if (needsStrip && creator) {
          devDeploy = await devDeployStatsForCreator(creator);
        }

        return { mint: bundle.token.mint, resolved, proTraders, devDeploy };
      } catch {
        return { mint: bundle.token.mint, resolved: null, proTraders: null, devDeploy: null };
      }
    }),
    mapPool(pumpTargets, PUMP_POOL, async (bundle) => {
      const pump = await fetchPumpFunCoin(bundle.token.mint);
      return { mint: bundle.token.mint, pump };
    }),
  ]);

  for (const { mint, resolved, proTraders, devDeploy } of holderResults) {
    if (!resolved && proTraders == null && !devDeploy) continue;
    const prev = byMint.get(mint);
    if (!prev) continue;
    const next = mergeHolderMetrics(prev, resolved, { proTraders, devDeploy });
    byMint.set(mint, next);
    persistMetricsAsync(next, false);
  }

  for (const { mint, pump } of pumpResults) {
    if (!pump) continue;
    const prev = byMint.get(mint);
    if (!prev) continue;
    const token = mergePumpIntoToken(prev, pump);
    const tokenDirty =
      token.twitter_handle !== prev.token.twitter_handle ||
      token.creator_wallet !== prev.token.creator_wallet ||
      token.website_url !== prev.token.website_url ||
      token.telegram_url !== prev.token.telegram_url;
    const next = { ...prev, token };
    byMint.set(mint, next);
    if (tokenDirty) persistMetricsAsync(next, true);
  }

  return bundles.map((b) => byMint.get(b.token.mint) ?? b);
}

/** Batch metrics for client-side Pulse row hydration. */
export async function fetchPulseMetricsForMints(
  mints: string[],
): Promise<
  Record<
    string,
    {
      holder_count: number | null;
      top10_holder_pct: number | null;
      dev_holding_pct: number | null;
      sniperHolderPct: number | null;
      pro_traders: number | null;
      dev_deploy_migrated: number | null;
      dev_deploy_total: number | null;
    }
  >
> {
  const uniq = [...new Set(mints.filter(Boolean))]
    .filter((m) => !pointerQaMintOnly() || isPointerQaMint(m))
    .slice(0, 24);
  const out: Record<
    string,
    {
      holder_count: number | null;
      top10_holder_pct: number | null;
      dev_holding_pct: number | null;
      sniperHolderPct: number | null;
      pro_traders: number | null;
      dev_deploy_migrated: number | null;
      dev_deploy_total: number | null;
    }
  > = {};

  await mapPool(uniq, 5, async (mint) => {
    if (inferMintKind(mint) !== 'sol') return;
    try {
      const [resolved, token] = await Promise.all([
        withTimeout(resolveTokenHolders(mint, { limit: 20 }), 9_000, 'pulse_metrics_batch'),
        getTokenByMint(mint),
      ]);
      if (!resolved) return;
      let sniperPct: number | null = null;
      let sniperSum = 0;
      for (const h of resolved.holders) {
        if (h.is_sniper && h.pct_of_supply != null) sniperSum += h.pct_of_supply;
      }
      if (sniperSum > 0) sniperPct = sniperSum;

      const proTraders = await countProTraders(resolved.holders);
      const creator = token?.creator_wallet?.trim();
      const devDeploy = creator ? await devDeployStatsForCreator(creator) : null;

      out[mint] = {
        holder_count: resolved.holderCountTotal,
        top10_holder_pct: resolved.top10HolderPct,
        dev_holding_pct: resolved.devHoldingPct,
        sniperHolderPct: sniperPct,
        pro_traders: proTraders,
        dev_deploy_migrated: devDeploy?.migrated ?? null,
        dev_deploy_total: devDeploy?.total ?? null,
      };
    } catch {
      /* skip mint */
    }
  });

  return out;
}
