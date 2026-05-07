/** Shared shape for `getTokenExtendedMetrics` API responses (client-safe). */
export interface TokenExtendedMetrics {
  top10HolderPct: number | null;
  devHoldingPct: number | null;
  sniperHolderPct: number | null;
  insidersPct: number | null;
  bundlersPct: number | null;
  lpBurnedPct: number | null;
  holders: number | null;
  proTraders: number | null;
  dexPaid: boolean | null;
  vol6hUsd: number | null;
  buys6h: number | null;
  sells6h: number | null;
  buyVol6hUsd: number | null;
  sellVol6hUsd: number | null;
  netVol6hUsd: number | null;
}
