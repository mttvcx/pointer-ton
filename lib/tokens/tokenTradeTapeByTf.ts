import type { TokenExtendedMetrics } from '@/lib/types/tokenExtendedMetrics';
import type { TokenTradePerfTf } from '@/lib/tokens/tokenTradePerfTfs';

export type TokenTradeTapeWindow = {
  volUsd: number;
  buys: number;
  sells: number;
  buyVolUsd: number;
  sellVolUsd: number;
  netVolUsd: number;
};

const EMPTY_TAPE: TokenTradeTapeWindow = {
  volUsd: 0,
  buys: 0,
  sells: 0,
  buyVolUsd: 0,
  sellVolUsd: 0,
  netVolUsd: 0,
};

/** Read indexed tape for a timeframe — no scaling/jitter; returns null when unavailable or partial. */
export function tapeMetricsForTf(
  m: TokenExtendedMetrics,
  tf: TokenTradePerfTf,
  _mint: string,
): TokenTradeTapeWindow | null {
  if (m.indexedVolPartial?.[tf]) return null;

  const indexed = m.tapeByTf?.[tf];
  if (indexed && (indexed.volUsd > 0 || indexed.buys > 0 || indexed.sells > 0)) {
    return indexed;
  }

  if (tf === '6h' && m.vol6hUsd != null) {
    return {
      volUsd: m.vol6hUsd ?? 0,
      buys: m.buys6h ?? 0,
      sells: m.sells6h ?? 0,
      buyVolUsd: m.buyVol6hUsd ?? 0,
      sellVolUsd: m.sellVol6hUsd ?? 0,
      netVolUsd: m.netVol6hUsd ?? 0,
    };
  }

  return null;
}

export function tapeMetricsForTfOrEmpty(
  m: TokenExtendedMetrics,
  tf: TokenTradePerfTf,
  mint: string,
): TokenTradeTapeWindow {
  return tapeMetricsForTf(m, tf, mint) ?? EMPTY_TAPE;
}
