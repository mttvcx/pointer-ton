import type React from 'react';

/** Persisted transform for a custom PnL tracker / share background image. */
export type PnlBackgroundTransform = {
  /** 1 = default cover fit; >1 zooms in, <1 zooms out */
  scale: number;
  /** Horizontal pan as % of preview width */
  offsetX: number;
  /** Vertical pan as % of preview height */
  offsetY: number;
};

export const DEFAULT_PNL_BACKGROUND_TRANSFORM: PnlBackgroundTransform = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
};

export const PNL_TRACKER_BG_MAX_BYTES = 200 * 1024;

export const PNL_TRACKER_BG_ASPECT = 2.8;

export function clampBackgroundScale(scale: number): number {
  return Math.min(4, Math.max(0.25, scale));
}

export function backgroundImageStyle(transform: PnlBackgroundTransform): React.CSSProperties {
  return {
    transform: `translate(${transform.offsetX}%, ${transform.offsetY}%) scale(${transform.scale})`,
    transformOrigin: 'center center',
  };
}
