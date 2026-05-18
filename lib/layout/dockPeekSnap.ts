/**
 * Shared magnet snap for draggable dock peek panels (Pulse, Wallet Tracker).
 * Snaps horizontally to the nearer left/right gutter when released near an edge,
 * plus light vertical snapping to top/bottom safe bands.
 */

export type DockPeekSnapDims = {
  panelW: number;
  panelH: number;
  viewportW: number;
  viewportH: number;
  /** Parsed --app-topbar-h (fallback inside caller). */
  topbarPx: number;
  /** Parsed --app-bottombar-h (fallback inside caller). */
  bottomBarPx: number;
};

const DEFAULT_MARGIN = 10;

export function snapDockPeekCoords(
  xy: { x: number; y: number },
  d: DockPeekSnapDims,
  opts?: { margin?: number; hSnapPx?: number; vSnapPx?: number },
): { x: number; y: number } {
  const margin = opts?.margin ?? DEFAULT_MARGIN;
  const hSnap = opts?.hSnapPx ?? 72;
  const vSnap = opts?.vSnapPx ?? 48;

  const { panelW: w, panelH: h, viewportW: vw, viewportH: vh, topbarPx: topbar, bottomBarPx: botbar } = d;

  const maxX = Math.max(margin, vw - w - margin);
  const maxBottom = vh - botbar - margin;

  let nx = Math.min(maxX, Math.max(margin, xy.x));
  let ny = Math.min(maxBottom - h, Math.max(topbar + margin, xy.y));

  const distLeft = nx - margin;
  const distRight = maxX - nx;
  if (distLeft <= hSnap || distRight <= hSnap) {
    nx = distLeft <= distRight ? margin : maxX;
  }

  const topAnch = topbar + margin;
  const bottomAnch = maxBottom - h - margin;
  const distTop = ny - topAnch;
  const distBottom = bottomAnch - ny;
  if (distTop <= vSnap || distBottom <= vSnap) {
    ny = distTop <= distBottom ? topAnch : bottomAnch;
    ny = Math.min(maxBottom - h, Math.max(topAnch, ny));
  }

  return { x: nx, y: ny };
}

export function readLayoutChromePx(): { topbar: number; botbar: number } {
  if (typeof document === 'undefined') return { topbar: 48, botbar: 40 };
  const top =
    Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--app-topbar-h')) || 48;
  const bot =
    Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--app-bottombar-h')) || 40;
  return { topbar: top, botbar: bot };
}

/** Keep top-left anchored float panel fully inside the viewport during drag / resize. */
export function clampPeekTopLeftWithinViewport(
  topLeft: { x: number; y: number },
  d: DockPeekSnapDims,
  opts?: { margin?: number },
): { x: number; y: number } {
  const margin = opts?.margin ?? DEFAULT_MARGIN;
  const { panelW: w, panelH: h, viewportW: vw, viewportH: vh, topbarPx: topbar, bottomBarPx: botbar } = d;
  const maxX = Math.max(margin, vw - w - margin);
  const maxBottom = vh - botbar - margin;
  return {
    x: Math.min(maxX, Math.max(margin, topLeft.x)),
    y: Math.min(maxBottom - h, Math.max(topbar + margin, topLeft.y)),
  };
}
