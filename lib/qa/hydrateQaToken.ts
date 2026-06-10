import 'server-only';

import { getLatestSnapshotForMint, insertMarketSnapshot, updateToken } from '@/lib/db/tokens';
import { fetchPumpFunCoin } from '@/lib/market/pumpFunCoin';
import { enrichPulseBundlesWithMetrics } from '@/lib/market/pulseMetricsEnrich';
import { isPointerQaMint } from '@/lib/qa/pointerQaMint';
import type { TokenRow } from '@/types/tokens';
import type { PulseTokenBundle } from '@/types/tokens';

/**
 * Manual QA hydrate: pump.fun creator/socials + holder metrics snapshot.
 * Invoked from `/api/tokens/[mint]/refresh-desk` only — not on page SSR.
 */
export async function hydrateQaTokenIfNeeded(
  mint: string,
  token: TokenRow,
): Promise<{ token: TokenRow; bundle: PulseTokenBundle | null }> {
  if (!isPointerQaMint(mint)) {
    return { token, bundle: null };
  }

  let next = token;
  const pump = await fetchPumpFunCoin(mint);
  if (pump) {
    const patch: Parameters<typeof updateToken>[1] = {};
    if (!next.creator_wallet?.trim() && pump.creator) patch.creator_wallet = pump.creator;
    if (!next.twitter_handle?.trim() && pump.twitter) patch.twitter_handle = pump.twitter;
    if (!next.telegram_url?.trim() && pump.telegram) patch.telegram_url = pump.telegram;
    if (!next.website_url?.trim() && pump.website) patch.website_url = pump.website;
    if (!next.symbol?.trim() && pump.symbol) patch.symbol = pump.symbol;
    if (!next.name?.trim() && pump.name) patch.name = pump.name;
    if (!next.image_url?.trim() && pump.image_uri) patch.image_url = pump.image_uri;
    if (Object.keys(patch).length > 0) {
      next = await updateToken(mint, patch);
    }
  }

  const snapshot = await getLatestSnapshotForMint(mint);
  const seed: PulseTokenBundle = { token: next, snapshot };
  const [enriched] = await enrichPulseBundlesWithMetrics([seed], 'sol');
  if (!enriched?.snapshot) {
    return { token: next, bundle: enriched ?? seed };
  }

  const snap = enriched.snapshot;
  await insertMarketSnapshot({
    mint,
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
  });

  return { token: next, bundle: enriched };
}
