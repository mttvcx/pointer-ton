/**
 * Web glassmorphism surface — a frosted-glass skin for floating panels (AI answer
 * box, co-pilot pill). Tuned for a dark UI: a faint white fill over a strong
 * backdrop blur + saturation, with a top inner highlight for the glass "edge"
 * sheen. This is the CSS approach (backdrop-filter) rather than Apple's native
 * material — it reads as premium glass on the web and degrades to a tinted panel
 * where backdrop-filter is unsupported.
 *
 * Apply as the surface classes (bg/border/blur/shadow) when the user picks the
 * "Glassy" AI panel style in Display settings.
 */
export const GLASS_SURFACE =
  'border-white/20 bg-white/[0.07] backdrop-blur-2xl backdrop-saturate-150 ' +
  'shadow-[0_10px_40px_-10px_rgba(0,0,0,0.6),inset_0_1px_0_0_rgba(255,255,255,0.28),inset_0_-1px_0_0_rgba(255,255,255,0.06)]';
