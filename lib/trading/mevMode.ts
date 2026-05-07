export type MevMode = 'off' | 'reduced' | 'secure';
export type SwapLandingUi = 'jito' | 'rpc';

/** Match swap landing to preset MEV mode (Phase 2: no separate server MEV field). */
export function mevModeToLanding(mev: MevMode): SwapLandingUi {
  if (mev === 'reduced') return 'jito';
  return 'rpc';
}
