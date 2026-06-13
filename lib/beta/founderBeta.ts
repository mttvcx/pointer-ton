import { BUY_PRESETS_SOL, BUY_PRESETS_USDC } from '@/lib/utils/constants';

/** Founder beta: desktop-first, smallest safe Sol buy presets for manual Phantom E2E.
 *  0.001 is the smallest size Jupiter reliably routes (sub-0.001 hits Jupiter
 *  minimum-amount errors). For E2E path validation use 0.001; size at 0.0001
 *  only when the route explicitly supports it. */
export const FOUNDER_BETA_BUY_PRESETS_SOL = [0.001, 0.01, 0.1, 0.5] as const;

export const FOUNDER_BETA_MIN_VIEWPORT_PX = 1024;

export function isFounderBetaMode(): boolean {
  return process.env.NEXT_PUBLIC_FOUNDER_BETA === '1';
}

export function resolveBuyPresetsSol(): readonly number[] {
  return isFounderBetaMode() ? FOUNDER_BETA_BUY_PRESETS_SOL : BUY_PRESETS_SOL;
}

export function resolveBuyPresetsUsdc(): readonly number[] {
  return BUY_PRESETS_USDC;
}

export function resolveDefaultBuyPresetSol(): number {
  const presets = resolveBuyPresetsSol();
  return presets[0] ?? 0.1;
}
