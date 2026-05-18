/**
 * Edge-based “sticky” docking hints for draggable peek panels — uses the
 * panel’s bounding box (not cursor x) like Axiom: when the floated window’s side
 * reaches the gutter, we show an affordance and allow click-in snap.
 */

export type FloatingPeekStickySide = 'left' | 'right';

/** Pixel distance from gutter (after clamp-margin) counts as overlapping the bezel. */
export const FLOATING_PEEK_EDGE_STICKY_PX = 54;

/** Panel center-Y must fall inside chrome-safe vertical band so dock feels intentional */
export function floatingPeekVerticalBandOk(
  top: number,
  height: number,
  vh: number,
  topbar: number,
  botbar: number,
): boolean {
  const cy = top + height / 2;
  return cy >= topbar + 26 && cy <= vh - botbar - 22;
}

/**
 * When dragging a clamped floating rect `{ left, top, width, height }`, which
 * bezel (if any) is the panel grazing?
 */
export function stickyDockSideFromFloatingRect(opts: {
  left: number;
  top: number;
  width: number;
  height: number;
  vw: number;
  vh: number;
  topbar: number;
  botbar: number;
  /** Screen margin matching {@link clampPeekTopLeftWithinViewport} */
  margin?: number;
  /** How close `left` or `left+width` must be to the inner bezel */
  edgePx?: number;
}): FloatingPeekStickySide | null {
  const margin = opts.margin ?? 10;
  const edgePx = opts.edgePx ?? FLOATING_PEEK_EDGE_STICKY_PX;
  const { left, top, width, height, vw, botbar } = opts;
  const vh = opts.vh;
  const topbar = opts.topbar;

  if (!floatingPeekVerticalBandOk(top, height, vh, topbar, botbar)) return null;

  const maxX = Math.max(margin, vw - width - margin);
  const distLeft = left - margin;
  const distRight = maxX - left;
  const stickL = distLeft <= edgePx;
  const stickR = distRight <= edgePx;
  if (!stickL && !stickR) return null;
  if (stickL && !stickR) return 'left';
  if (stickR && !stickL) return 'right';
  return distLeft <= distRight ? 'left' : 'right';
}
