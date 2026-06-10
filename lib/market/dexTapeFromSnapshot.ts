import type { TokenMarketSnapshotRow } from '@/lib/db/tokens';
import type { TokenTapeWindowMetrics } from '@/lib/types/tokenExtendedMetrics';
import type { TokenTradePerfTf } from '@/lib/tokens/tokenTradePerfTfs';

function windowFromVol(volUsd: number | null | undefined): TokenTapeWindowMetrics | null {
  if (volUsd == null || !Number.isFinite(volUsd) || volUsd <= 0) return null;
  return {
    volUsd,
    buys: 0,
    sells: 0,
    buyVolUsd: 0,
    sellVolUsd: 0,
    netVolUsd: 0,
  };
}

/** DexScreener snapshot vol for desk tape when indexed swaps are empty for a window. */
export function dexTapeFromSnapshot(
  snap: TokenMarketSnapshotRow | null | undefined,
): Partial<Record<TokenTradePerfTf, TokenTapeWindowMetrics>> {
  if (!snap) return {};
  const out: Partial<Record<TokenTradePerfTf, TokenTapeWindowMetrics>> = {};
  const w5 = windowFromVol(snap.volume_5m_usd);
  const w1 = windowFromVol(snap.volume_1h_usd);
  const w24 = windowFromVol(snap.volume_24h_usd);
  if (w5) out['5m'] = w5;
  if (w1) out['1h'] = w1;
  if (w24) out['24h'] = w24;
  return out;
}
