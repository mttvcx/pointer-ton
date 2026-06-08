import type { OverlayAccent } from '@/lib/share/types';

export const ACCENT_HEX: Record<OverlayAccent, string> = {
  teal: '#2dd4bf',
  purple: '#c084fc',
  blue: '#60a5fa',
  green: '#4ade80',
};

export const ACCENT_GLOW_RGBA: Record<OverlayAccent, string> = {
  teal: 'rgba(45, 212, 191, 0.38)',
  purple: 'rgba(192, 132, 252, 0.38)',
  blue: 'rgba(96, 165, 250, 0.38)',
  green: 'rgba(74, 222, 128, 0.38)',
};

export const ACCENT_SOFT_RGBA: Record<OverlayAccent, string> = {
  teal: 'rgba(45, 212, 191, 0.14)',
  purple: 'rgba(192, 132, 252, 0.14)',
  blue: 'rgba(96, 165, 250, 0.14)',
  green: 'rgba(74, 222, 128, 0.14)',
};

export function accentHex(accent: OverlayAccent): string {
  return ACCENT_HEX[accent];
}
