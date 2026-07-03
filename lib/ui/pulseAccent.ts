import { hexToRgb, normalizeHex } from '@/lib/ui/colorMath';

/** Axiom's signature blue Quick-Buy button — the default so Axiom users feel at home. */
export const AXIOM_BUY_ACCENT_HEX = '#3D8BFF';

/** Default quick-buy accent. Axiom-blue by default ('#34D399' was the legacy emerald). */
export const DEFAULT_PULSE_ACCENT_HEX = AXIOM_BUY_ACCENT_HEX;

export function hexToRgbTriplet(hex: string): string {
  const { r, g, b } = hexToRgb(normalizeHex(hex));
  return `${r} ${g} ${b}`;
}

/** Text/icon on solid filled quick-buy buttons. */
export function contrastOnAccentHex(hex: string): string {
  const { r, g, b } = hexToRgb(normalizeHex(hex));
  const l = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return l > 0.58 ? '#030806' : '#F8FAFC';
}

export function applyPulseAccentToDocument(hex: string): void {
  if (typeof document === 'undefined') return;
  const safe = normalizeHex(hex);
  const root = document.documentElement;
  root.setAttribute('data-pulse-accent', safe);
  root.style.setProperty('--pulse-accent-rgb', hexToRgbTriplet(safe));
  root.style.setProperty('--pulse-accent-on-rgb', hexToRgbTriplet(contrastOnAccentHex(safe)));
}
