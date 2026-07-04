'use client';

import { usePulseDisplayPrefsStore } from '@/store/pulseDisplayPrefs';

export type ToastSurface = {
  /** true when a custom toast colour is active (otherwise use default dark theme). */
  custom: boolean;
  bg: string;
  fg: string;
  fgMuted: string;
  border: string;
};

const DEFAULT_SURFACE: ToastSurface = { custom: false, bg: '', fg: '', fgMuted: '', border: '' };

/** Build a readable toast surface from a chosen colour — contents invert for contrast. */
export function toastSurfaceFrom(color: string | null | undefined): ToastSurface {
  if (!color) return DEFAULT_SURFACE;
  const h = color.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return DEFAULT_SURFACE;
  // Perceived luminance (0–1). Light background → dark contents, and vice-versa.
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const darkContents = lum > 0.6;
  return {
    custom: true,
    bg: color,
    fg: darkContents ? '#0a0c10' : '#f5f7fc',
    fgMuted: darkContents ? 'rgba(10,12,16,0.62)' : 'rgba(245,247,252,0.68)',
    border: darkContents ? 'rgba(10,12,16,0.18)' : 'rgba(255,255,255,0.16)',
  };
}

/** Current toast surface, read imperatively (for toast.custom fire functions). */
export function readToastSurface(): ToastSurface {
  return toastSurfaceFrom(usePulseDisplayPrefsStore.getState().toastColor);
}
