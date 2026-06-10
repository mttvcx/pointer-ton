import type { MintSwapRow } from '@/lib/db/mintSwaps';
import { inferSwapEventKind } from '@/lib/indexer/inferSwapEventKind';
import type { TokenTradePerfTf } from '@/lib/tokens/tokenTradePerfTfs';

export type MintSwapWindowMetrics = {
  volUsd: number;
  buys: number;
  sells: number;
  buyVolUsd: number;
  sellVolUsd: number;
  netVolUsd: number;
};

/** Aggregate 6h (or custom) desk vol from indexed mint_swaps — swaps only, excludes remove/add liq. */
export function aggregateMintSwapWindowMetrics(
  swaps: MintSwapRow[],
  windowMs: number,
  nowMs = Date.now(),
): MintSwapWindowMetrics {
  const cutoff = nowMs - windowMs;
  let volUsd = 0;
  let buys = 0;
  let sells = 0;
  let buyVolUsd = 0;
  let sellVolUsd = 0;

  for (const row of swaps) {
    const ts = new Date(row.block_time).getTime();
    if (!Number.isFinite(ts) || ts < cutoff) continue;

    const kind = inferSwapEventKind(row);
    if (kind !== 'swap') continue;

    const usd =
      row.usd_amount != null && Number.isFinite(row.usd_amount) && row.usd_amount > 0
        ? row.usd_amount
        : row.price_usd != null && row.token_amount_ui > 0
          ? row.price_usd * row.token_amount_ui
          : 0;

    if (usd <= 0) continue;
    volUsd += usd;
    if (row.side === 'buy') {
      buys += 1;
      buyVolUsd += usd;
    } else {
      sells += 1;
      sellVolUsd += usd;
    }
  }

  return {
    volUsd,
    buys,
    sells,
    buyVolUsd,
    sellVolUsd,
    netVolUsd: buyVolUsd - sellVolUsd,
  };
}

const TF_MS: Record<TokenTradePerfTf, number> = {
  '5m': 5 * 60_000,
  '1h': 60 * 60_000,
  '6h': 6 * 60 * 60_000,
  '24h': 24 * 60 * 60_000,
};

/** Single-pass vol/buy/sell for all desk timeframes from mint_swaps. */
export function aggregateMintSwapTapeByTf(
  swaps: MintSwapRow[],
  nowMs = Date.now(),
): Record<TokenTradePerfTf, MintSwapWindowMetrics> {
  const out = {} as Record<TokenTradePerfTf, MintSwapWindowMetrics>;
  for (const tf of Object.keys(TF_MS) as TokenTradePerfTf[]) {
    out[tf] = aggregateMintSwapWindowMetrics(swaps, TF_MS[tf], nowMs);
  }
  return out;
}

/** True when oldest indexed swap is younger than the TF window (partial coverage). */
export function indexedVolCoverageByTf(
  swaps: MintSwapRow[],
  nowMs = Date.now(),
): Record<TokenTradePerfTf, boolean> {
  let oldestMs: number | null = null;
  for (const row of swaps) {
    const ts = new Date(row.block_time).getTime();
    if (!Number.isFinite(ts)) continue;
    if (oldestMs == null || ts < oldestMs) oldestMs = ts;
  }
  const out = {} as Record<TokenTradePerfTf, boolean>;
  for (const tf of Object.keys(TF_MS) as TokenTradePerfTf[]) {
    if (oldestMs == null) {
      out[tf] = true;
      continue;
    }
    out[tf] = nowMs - oldestMs < TF_MS[tf];
  }
  return out;
}
