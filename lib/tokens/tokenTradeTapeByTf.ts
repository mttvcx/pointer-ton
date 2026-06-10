import type { TokenExtendedMetrics, TokenTapeWindowMetrics } from '@/lib/types/tokenExtendedMetrics';
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

function hasIndexedTape(
  tape: TokenTapeWindowMetrics | undefined,
): tape is TokenTapeWindowMetrics {
  return tape != null;
}

/**
 * Read desk tape for a timeframe.
 * Prefers indexed mint_swaps; falls back to Dex snapshot vol when indexed is empty.
 * Partial windows still show indexed data (label with * in UI).
 */
export function tapeMetricsForTf(
  m: TokenExtendedMetrics,
  tf: TokenTradePerfTf,
  _mint: string,
): TokenTradeTapeWindow | null {
  const indexed = m.tapeByTf?.[tf];
  if (hasIndexedTape(indexed)) {
    if (indexed.volUsd > 0 || indexed.buys > 0 || indexed.sells > 0) {
      return indexed;
    }
    const dex = m.dexTapeByTf?.[tf];
    if (dex && dex.volUsd > 0) {
      return dex;
    }
    return indexed;
  }

  const dex = m.dexTapeByTf?.[tf];
  if (dex && dex.volUsd > 0) {
    return dex;
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

  if (m.indexedVolPartial?.[tf]) {
    return null;
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
