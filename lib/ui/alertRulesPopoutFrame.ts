/** Geometry for the floating Alert Builder — shared so initial open matches resize clamps (Axiom-ish caps). */

const MIN_W = 280;
export const ALERT_POPOUT_MAX_W = 420;
const MIN_H = 240;
const PAD = 8;
const MAX_H_STATIC = 560;

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

function bottomBarPx() {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--app-bottombar-h').trim();
  const m = /^([\d.]+)px$/.exec(raw);
  if (m?.[1]) return parseFloat(m[1]);
  return 52;
}

/** Clamp drag / resize / initial detached rect to viewport and max panel size. */
export function clampAlertRulesPopoutFrame(top: number, left: number, width: number, height: number) {
  const winW = window.innerWidth;
  const winH = window.innerHeight;
  const bottomGap = bottomBarPx() + PAD;

  const maxWViewport = Math.min(ALERT_POPOUT_MAX_W, Math.floor(winW * 0.4));
  const maxHViewport = Math.min(MAX_H_STATIC, Math.floor(winH * 0.72));

  let w = clamp(width, MIN_W, maxWViewport);
  let h = clamp(height, MIN_H, maxHViewport);
  w = Math.min(w, winW - PAD * 2);
  h = Math.min(h, winH - PAD - bottomGap);

  const l = clamp(left, PAD, winW - w - PAD);
  const t = clamp(top, PAD, winH - h - bottomGap);

  w = Math.min(w, winW - l - PAD);
  h = Math.min(h, winH - t - bottomGap);

  return {
    top: Math.round(t),
    left: Math.round(l),
    width: Math.round(w),
    height: Math.round(h),
  };
}
