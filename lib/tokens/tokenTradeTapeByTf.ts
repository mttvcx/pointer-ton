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

const TF_SCALE: Record<TokenTradePerfTf, number> = {
  '5m': 5 / 360,
  '1h': 1 / 6,
  '6h': 1,
  '24h': 4,
};

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Scale 6h tape metrics to other windows until per-TF API fields exist. */
export function tapeMetricsForTf(
  m: TokenExtendedMetrics,
  tf: TokenTradePerfTf,
  mint: string,
): TokenTradeTapeWindow {
  const scale = TF_SCALE[tf];
  const jitter = 0.9 + (hashSeed(`${mint}:tape:${tf}`) % 20) / 100;

  const buyVolUsd = (m.buyVol6hUsd ?? 0) * scale * jitter;
  const sellVolUsd = (m.sellVol6hUsd ?? 0) * scale * jitter;
  const netVolUsd = (m.netVol6hUsd ?? 0) * scale * jitter;

  return {
    volUsd: (m.vol6hUsd ?? 0) * scale * jitter,
    buys: Math.max(0, Math.round((m.buys6h ?? 0) * scale * jitter)),
    sells: Math.max(0, Math.round((m.sells6h ?? 0) * scale * jitter)),
    buyVolUsd,
    sellVolUsd,
    netVolUsd,
  };
}
