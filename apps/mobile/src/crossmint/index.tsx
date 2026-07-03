import React from 'react';
import { DEMO } from '../auth';
import { CROSSMINT_CLIENT_KEY } from '../env';
import type { CrossmintCheckoutProps } from './checkout';

/** True only when the real Apple Pay → token checkout can run (real build + key). */
export const CROSSMINT_READY = !DEMO && Boolean(CROSSMINT_CLIENT_KEY);

/**
 * Real-mode Crossmint checkout. The native SDK is `require`d lazily so Expo Go /
 * demo never loads it (mirrors how Privy is gated). Renders null when unavailable
 * — the caller shows a "runs in the dev build" fallback.
 */
export function CrossmintBuy(props: CrossmintCheckoutProps) {
  if (!CROSSMINT_READY) return null;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { CrossmintCheckout } = require('./checkout') as typeof import('./checkout');
  return <CrossmintCheckout {...props} />;
}

export type { CrossmintCheckoutProps } from './checkout';
