import { isUiDemoMode, preferTokenTableDemoRows, uiDemoModeFromEnv } from '@/lib/dev/uiDemoMode';
import type { TokenExtendedMetrics } from '@/lib/types/tokenExtendedMetrics';

/** Server / build-time: demo fixtures allowed (env only — no localStorage). */
export function demoFixturesEnabledServer(): boolean {
  return uiDemoModeFromEnv();
}

/** Client: demo tables + synthetic rows when ui demo or table-demo env flag is on. */
export function demoTablesEnabled(uiDemo: boolean): boolean {
  return uiDemo || preferTokenTableDemoRows();
}

/** Client: full demo fixture deck (Pulse rows, wallet intel directory, etc.). */
export function demoFixturesEnabledClient(uiDemo: boolean): boolean {
  return uiDemo;
}

/** Live-safe empty extended metrics — never invent holder/security numbers. */
export const EMPTY_TOKEN_EXTENDED_METRICS: TokenExtendedMetrics = {
  top10HolderPct: null,
  devHoldingPct: null,
  sniperHolderPct: null,
  insidersPct: null,
  bundlersPct: null,
  lpBurnedPct: null,
  holders: null,
  proTraders: null,
  dexPaid: null,
  vol6hUsd: null,
  buys6h: null,
  sells6h: null,
  buyVol6hUsd: null,
  sellVol6hUsd: null,
  netVol6hUsd: null,
  taxPct: null,
};
