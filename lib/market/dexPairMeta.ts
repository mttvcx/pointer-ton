/** Minimal DexScreener pair shape for quote / venue metadata extraction. */
export type DexPairQuoteMeta = {
  dexId?: string;
  pairAddress?: string;
  baseToken?: { symbol?: string };
  quoteToken?: { address?: string; symbol?: string };
};

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
  return out;
}
