/**
 * Restrained "moment reveal" timing for PnL share exports — shared by React preview and canvas video.
 * Optimized for a single focal read (the amount), not full-card motion.
 */
export const PNL_MOMENT_DURATION_SEC = 1.35;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** Smooth deceleration — keynote-ish, not bouncy */
export function easeCinematicOut(t: number): number {
  const u = clamp01(t);
  return 1 - Math.pow(1 - u, 2.35);
}

export type PnlMomentSnapshot = {
  /** 0–1; use for count interpolation */
  countProgress: number;
  /** Text / emphasis alpha */
  opacity: number;
  /** Micro-scale "forward" (≈0.92 → ~1.01 → 1) */
  scale: number;
  /** Simulated optical blur settling (px) — canvas uses shadowBlur; DOM uses filter */
  blurPx: number;
  /** Restrained luminance behind the figure (0–1) */
  glowStrength: number;
};

/**
 * Samples the hero amount emphasis curve at elapsed seconds since the reveal started.
 * After {@link PNL_MOMENT_DURATION_SEC}, returns a stable settled state.
 */
export function pnlMomentSnapshot(tSec: number): PnlMomentSnapshot {
  if (!Number.isFinite(tSec) || tSec <= 0) {
    return {
      countProgress: 0,
      opacity: 0,
      scale: 0.92,
      blurPx: 7.5,
      glowStrength: 0,
    };
  }
  if (tSec >= PNL_MOMENT_DURATION_SEC) {
    return {
      countProgress: 1,
      opacity: 1,
      scale: 1,
      blurPx: 0,
      glowStrength: 0,
    };
  }

  const u = tSec / PNL_MOMENT_DURATION_SEC;
  const countProgress = easeCinematicOut(u);

  /* Opacity: lands early so type never feels "late" vs the scene */
  const opacity = clamp01(easeCinematicOut(tSec / (PNL_MOMENT_DURATION_SEC * 0.32)));

  /* Scale: subtle overshoot then settle — not a slot-machine punch */
  let scale: number;
  if (u < 0.52) {
    const k = u / 0.52;
    const e = 1 - Math.pow(1 - k, 2.8);
    scale = 0.92 + e * 0.095;
  } else if (u < 0.78) {
    const k = (u - 0.52) / 0.26;
    scale = 1.015 + (Math.sin(k * Math.PI) * 0.006 - 0.006 * k);
  } else {
    const k = (u - 0.78) / 0.22;
    scale = 1 + (0.008 * (1 - k));
  }
  scale = Math.min(1.018, Math.max(0.9, scale));

  const blurPx = Math.max(0, 7.5 * (1 - Math.min(1, u / 0.62)));
  const glowStrength =
    u < 0.42 ? 0.22 * Math.sin((u / 0.42) * Math.PI) : 0.06 + 0.1 * (1 - Math.min(1, (u - 0.42) / 0.58));

  return { countProgress, opacity, scale, blurPx, glowStrength };
}
