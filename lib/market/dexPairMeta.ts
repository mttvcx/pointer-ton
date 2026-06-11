/** Minimal DexScreener pair shape for quote / venue metadata extraction. */
export type DexPairQuoteMeta = {
  dexId?: string;
  pairAddress?: string;
  baseToken?: { symbol?: string };
  quoteToken?: { address?: string; symbol?: string };
  volume?: { m5?: number; h1?: number; h6?: number; h24?: number } | null;
  txns?: {
    m5?: { buys?: number; sells?: number } | null;
    h1?: { buys?: number; sells?: number } | null;
    h6?: { buys?: number; sells?: number } | null;
    h24?: { buys?: number; sells?: number } | null;
  } | null;
};

function txnSplit(
  txns: DexPairQuoteMeta['txns'],
  window: 'm5' | 'h1' | 'h6' | 'h24',
): { buys: number; sells: number } | null {
  const bucket = txns?.[window];
  if (!bucket) return null;
  const buys = Number(bucket.buys) || 0;
  const sells = Number(bucket.sells) || 0;
  if (buys + sells <= 0) return null;
  return { buys, sells };
}

/** Pair quote / venue fields for Pulse header (USDC tier, migrated pumpswap, etc.). */
export function dexPairExtendedMetrics(pair: DexPairQuoteMeta): Record<string, unknown> {
  const quote = pair.quoteToken;
  const base = pair.baseToken;
  const dexId = pair.dexId?.trim().toLowerCase() ?? null;
  const out: Record<string, unknown> = {
    dexId: pair.dexId ?? null,
    pairAddress: pair.pairAddress ?? null,
  };
  if (quote?.symbol?.trim()) out.quoteSymbol = quote.symbol.trim().toUpperCase();
  if (quote?.address?.trim()) out.quoteMint = quote.address.trim();
  if (base?.symbol?.trim() && quote?.symbol?.trim()) {
    out.poolName = `${base.symbol.trim()}/${quote.symbol.trim()}`;
  }
  if (dexId === 'pumpswap' || dexId === 'raydium') out.dexMigrated = true;

  const vol = pair.volume;
  if (vol?.h6 != null && Number.isFinite(Number(vol.h6))) out.volumeH6 = Number(vol.h6);
  if (vol?.h24 != null && Number.isFinite(Number(vol.h24))) out.volumeH24 = Number(vol.h24);

  for (const w of ['m5', 'h1', 'h6', 'h24'] as const) {
    const split = txnSplit(pair.txns, w);
    if (!split) continue;
    out[`txns${w.toUpperCase()}Buys`] = split.buys;
    out[`txns${w.toUpperCase()}Sells`] = split.sells;
  }

  return out;
}
