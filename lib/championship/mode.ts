import { uiDemoModeFromEnv } from '@/lib/dev/uiDemoMode';

/**
 * Championship demo fixtures — only when UI demo mode is enabled.
 * Live private beta shows empty/provisional states without invented PnL.
 */
export function championshipDemoDataEnabled(): boolean {
  const v = process.env.NEXT_PUBLIC_CHAMPIONSHIP_DEMO;
  if (v === '1' || v === 'true') return true;
  if (v === '0' || v === 'false') return false;
  return uiDemoModeFromEnv();
}
