/** Shared chart / header overlay toggles (Display Options). */

export const CHART_OVERLAY_KEY = 'pointer-token-chart-overlays-v1';

export type ChartOverlayFlags = {
  devTrades: boolean;
  trackedOnly: boolean;
  alertBubbles: boolean;
};

export function readChartOverlays(): ChartOverlayFlags {
  if (typeof window === 'undefined') {
    return { devTrades: true, trackedOnly: false, alertBubbles: true };
  }
  try {
    const raw = localStorage.getItem(CHART_OVERLAY_KEY);
    if (!raw) return { devTrades: true, trackedOnly: false, alertBubbles: true };
    const j = JSON.parse(raw) as Partial<ChartOverlayFlags>;
    return {
      devTrades: j.devTrades !== false,
      trackedOnly: j.trackedOnly === true,
      alertBubbles: j.alertBubbles !== false,
    };
  } catch {
    return { devTrades: true, trackedOnly: false, alertBubbles: true };
  }
}

export function persistChartOverlays(f: ChartOverlayFlags) {
  try {
    localStorage.setItem(CHART_OVERLAY_KEY, JSON.stringify(f));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pointer-chart-overlays'));
    }
  } catch {
    /* no-op */
  }
}
