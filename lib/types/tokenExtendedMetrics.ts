import type { TokenTradePerfTf } from '@/lib/tokens/tokenTradePerfTfs';

export type TokenTapeWindowMetrics = {
  volUsd: number;
  buys: number;
  sells: number;
  buyVolUsd: number;
  sellVolUsd: number;
  netVolUsd: number;
};

/** Shared shape for `getTokenExtendedMetrics` API responses (client-safe). */
export interface TokenExtendedMetrics {
  /** Adjusted top-10 % (LP/vault excluded when pool addresses known). */
  top10HolderPct: number | null;
  /** Raw top-10 % including LP/vault rows. */
  top10HolderPctRaw?: number | null;
  devHoldingPct: number | null;
  sniperHolderPct: number | null;
  insidersPct: number | null;
  bundlersPct: number | null;
  lpBurnedPct: number | null;
  /** Total holder count — never top-N row count. */
  holders: number | null;
  /** Top-N holder rows loaded for desk table. */
  holderRowsLoaded?: number | null;
  proTraders: number | null;
  dexPaid: boolean | null;
  vol6hUsd: number | null;
  buys6h: number | null;
  sells6h: number | null;
  buyVol6hUsd: number | null;
  sellVol6hUsd: number | null;
  netVol6hUsd: number | null;
  /** Per-TF tape from mint_swaps (QA indexer mints). Null when unavailable. */
  tapeByTf?: Partial<Record<TokenTradePerfTf, TokenTapeWindowMetrics>> | null;
  /** True when indexed swap history does not span the requested TF window. */
  indexedVolPartial?: Partial<Record<TokenTradePerfTf, boolean>> | null;
  /** Transfer / trade tax % when known (buy+sell combined or total fee). */
  taxPct: number | null;
}
