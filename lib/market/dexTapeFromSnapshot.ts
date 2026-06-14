import type { TokenMarketSnapshotRow } from '@/lib/db/tokens';
import type { TokenTapeWindowMetrics } from '@/lib/types/tokenExtendedMetrics';
import type { TokenTradePerfTf } from '@/lib/tokens/tokenTradePerfTfs';

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

type DexExt = Record<string, unknown>;

function extRecord(snap: TokenMarketSnapshotRow): DexExt | null {
  const ext = snap.extended_metrics;
  if (ext != null && typeof ext === 'object' && !Array.isArray(ext)) return ext as DexExt;
  return null;
}

const TF_TXN_KEY: Record<TokenTradePerfTf, string> = {
  '5m': 'M5',
  '1h': 'H1',
  '6h': 'H6',
  '24h': 'H24',
};

/**
 * Build a Dex-aggregate window: vol + txn counts from DexScreener.
 * When txn counts exist, allocate vol proportionally (same as lighthouse aggregate).
 */
function dexWindow(
  volUsd: number | null,
  ext: DexExt | null,
  tf: TokenTradePerfTf,
): TokenTapeWindowMetrics | null {
  if (volUsd == null || !Number.isFinite(volUsd) || volUsd <= 0) return null;
  const key = TF_TXN_KEY[tf];
  const buys = ext ? num(ext[`txns${key}Buys`]) : null;
  const sells = ext ? num(ext[`txns${key}Sells`]) : null;
  const buyCount = buys != null && buys >= 0 ? buys : 0;
  const sellCount = sells != null && sells >= 0 ? sells : 0;
  const txnTotal = buyCount + sellCount;

  if (txnTotal > 0) {
    const buyVolUsd = volUsd * (buyCount / txnTotal);
    const sellVolUsd = volUsd * (sellCount / txnTotal);
    return {
      volUsd,
      buys: buyCount,
      sells: sellCount,
      buyVolUsd,
      sellVolUsd,
      netVolUsd: buyVolUsd - sellVolUsd,
    };
  }

  return {
    volUsd,
    buys: buyCount,
    sells: sellCount,
    buyVolUsd: 0,
    sellVolUsd: 0,
    netVolUsd: 0,
    dexAggregate: true,
  };
}

/**
 * DexScreener snapshot tape for desk windows when indexed swaps are empty.
 * Vol comes from snapshot columns (5m/1h/24h) plus `volumeH6` stashed in
 * extended_metrics; buy/sell txn counts come from `txns{M5,H1,H6,H24}{Buys,Sells}`.
 */
export function dexTapeFromSnapshot(
  snap: TokenMarketSnapshotRow | null | undefined,
): Partial<Record<TokenTradePerfTf, TokenTapeWindowMetrics>> {
  if (!snap) return {};
  const ext = extRecord(snap);
  const out: Partial<Record<TokenTradePerfTf, TokenTapeWindowMetrics>> = {};

  const w5 = dexWindow(snap.volume_5m_usd, ext, '5m');
  const w1 = dexWindow(snap.volume_1h_usd, ext, '1h');
  const w6 = dexWindow(ext ? num(ext.volumeH6) : null, ext, '6h');
  const w24 = dexWindow(snap.volume_24h_usd, ext, '24h');

  if (w5) out['5m'] = w5;
  if (w1) out['1h'] = w1;
  if (w6) out['6h'] = w6;
  if (w24) out['24h'] = w24;
  return out;
}
