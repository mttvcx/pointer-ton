'use client';

import {
  FOUNDER_BETA_MIN_VIEWPORT_PX,
  isFounderBetaMode,
} from '@/lib/beta/founderBeta';

/** True on narrow viewports during founder beta — trading should be blocked with a clear message. */
export function isFounderBetaMobileTradeBlocked(): boolean {
  if (!isFounderBetaMode()) return false;
  if (typeof window === 'undefined') return false;
  return window.matchMedia(`(max-width: ${FOUNDER_BETA_MIN_VIEWPORT_PX - 1}px)`).matches;
}

export function founderBetaMobileTradeMessage(): string {
  return `Founder beta targets desktop (${FOUNDER_BETA_MIN_VIEWPORT_PX}px+). Widen the window or use a laptop.`;
}
