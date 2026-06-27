'use client';

/**
 * Real "liquid glass" surface — a faithful port of the ui-layouts.com
 * LiquidGlassCard (https://ui-layouts.com/components/liquid-glass). The refraction
 * is an SVG turbulence + displacement filter applied to an empty backdrop-blurred
 * "bend" layer that sits BEHIND the content; two box-shadow layers add the outer
 * glow and the inner glass-edge highlight. This is the "Glassy" AI-panel style.
 *
 * The simpler CSS-only frosted skin (no refraction) is the "Light" style and
 * lives in `lib/ui/glassSurface.ts`.
 *
 * Port notes vs. the upstream source:
 *   - dropped the `motion/react` dependency (not installed); the standalone card
 *     gets a tiny pointer-based drag instead.
 *   - Tailwind v3 `backdrop-blur-*` classes (upstream used the v4 `-xs`).
 *   - our `@/lib/utils/cn` import alias.
 *   - a second, gentler displacement filter for compact panels — the upstream
 *     `scale=200` is tuned for large cards and reads as noise on small surfaces.
 */

import { useCallback, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

/** Strong refraction (faithful upstream default) — for large cards. */
export const LIQUID_GLASS_FILTER_ID = 'pointer-liquid-glass';
/** Gentle refraction — for compact panels (AI co-pilot pill + brief). */
export const LIQUID_GLASS_FILTER_ID_SOFT = 'pointer-liquid-glass-soft';

type BlurIntensity = 'sm' | 'md' | 'lg' | 'xl';
type ShadowIntensity = 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
type GlowIntensity = 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const BLUR_CLASS: Record<BlurIntensity, string> = {
  sm: 'backdrop-blur-sm',
  md: 'backdrop-blur-md',
  lg: 'backdrop-blur-lg',
  xl: 'backdrop-blur-xl',
};

// Inner white highlight (the glass bezel). Verbatim from upstream.
const EDGE_SHADOW: Record<ShadowIntensity, string> = {
  none: 'inset 0 0 0 0 rgba(255,255,255,0)',
  xs: 'inset 1px 1px 1px 0 rgba(255,255,255,0.3), inset -1px -1px 1px 0 rgba(255,255,255,0.3)',
  sm: 'inset 2px 2px 2px 0 rgba(255,255,255,0.35), inset -2px -2px 2px 0 rgba(255,255,255,0.35)',
  md: 'inset 3px 3px 3px 0 rgba(255,255,255,0.45), inset -3px -3px 3px 0 rgba(255,255,255,0.45)',
  lg: 'inset 4px 4px 4px 0 rgba(255,255,255,0.5), inset -4px -4px 4px 0 rgba(255,255,255,0.5)',
  xl: 'inset 6px 6px 6px 0 rgba(255,255,255,0.55), inset -6px -6px 6px 0 rgba(255,255,255,0.55)',
};

// Outer glow + drop shadow. Verbatim from upstream.
const GLOW_SHADOW: Record<GlowIntensity, string> = {
  none: '0 4px 4px rgba(0,0,0,0.05), 0 0 12px rgba(0,0,0,0.05)',
  xs: '0 4px 4px rgba(0,0,0,0.15), 0 0 12px rgba(0,0,0,0.08), 0 0 16px rgba(255,255,255,0.05)',
  sm: '0 4px 4px rgba(0,0,0,0.15), 0 0 12px rgba(0,0,0,0.08), 0 0 24px rgba(255,255,255,0.1)',
  md: '0 4px 4px rgba(0,0,0,0.15), 0 0 12px rgba(0,0,0,0.08), 0 0 32px rgba(255,255,255,0.15)',
  lg: '0 4px 4px rgba(0,0,0,0.15), 0 0 12px rgba(0,0,0,0.08), 0 0 40px rgba(255,255,255,0.2)',
  xl: '0 4px 4px rgba(0,0,0,0.15), 0 0 12px rgba(0,0,0,0.08), 0 0 48px rgba(255,255,255,0.25)',
};

/**
 * The shared SVG filters that power every liquid-glass surface. Mount ONCE near
 * the app root (a hidden, zero-cost `<svg>`); all glass layers reference these
 * by id via `filter: url(#…)`.
 */
export function LiquidGlassDefs() {
  return (
    <svg className="pointer-events-none absolute h-0 w-0" aria-hidden focusable="false">
      <defs>
        {/* Strong — faithful upstream tuning for large cards. */}
        <filter
          id={LIQUID_GLASS_FILTER_ID}
          x="0"
          y="0"
          width="100%"
          height="100%"
          filterUnits="objectBoundingBox"
        >
          <feTurbulence type="fractalNoise" baseFrequency="0.003 0.007" numOctaves="1" result="turbulence" />
          <feDisplacementMap in="SourceGraphic" in2="turbulence" scale="200" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        {/* Soft — tighter ripples + smaller displacement for compact panels. */}
        <filter
          id={LIQUID_GLASS_FILTER_ID_SOFT}
          x="0"
          y="0"
          width="100%"
          height="100%"
          filterUnits="objectBoundingBox"
        >
          <feTurbulence type="fractalNoise" baseFrequency="0.008 0.014" numOctaves="2" result="turbulence" />
          <feDisplacementMap in="SourceGraphic" in2="turbulence" scale="56" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    </svg>
  );
}

/**
 * The three stacked glass layers (refraction + glow + edge), clipped to
 * `borderRadius`. Drop as the FIRST child of any `relative` container, then mark
 * the real content `relative z-10` so it sits above the refraction.
 *
 * `softer` swaps in the gentle displacement filter (use for compact surfaces).
 */
export function LiquidGlassLayers({
  borderRadius = '16px',
  blurIntensity = 'md',
  glowIntensity = 'sm',
  shadowIntensity = 'sm',
  softer = false,
}: {
  borderRadius?: string;
  blurIntensity?: BlurIntensity;
  glowIntensity?: GlowIntensity;
  shadowIntensity?: ShadowIntensity;
  softer?: boolean;
}) {
  const filterId = softer ? LIQUID_GLASS_FILTER_ID_SOFT : LIQUID_GLASS_FILTER_ID;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ borderRadius }} aria-hidden>
      {/* Bend: backdrop blur warped by the displacement filter. */}
      <div
        className={cn('absolute inset-0', BLUR_CLASS[blurIntensity])}
        style={{ filter: `url(#${filterId})`, WebkitFilter: `url(#${filterId})` }}
      />
      {/* Face: outer glow + drop shadow. */}
      <div className="absolute inset-0" style={{ boxShadow: GLOW_SHADOW[glowIntensity] }} />
      {/* Edge: inner white highlight. */}
      <div className="absolute inset-0" style={{ boxShadow: EDGE_SHADOW[shadowIntensity] }} />
    </div>
  );
}

/**
 * Standalone liquid-glass card — `relative` container + the three glass layers +
 * a `z-10` content wrapper. Mirrors the upstream component's prop surface so it
 * can be reused (e.g. an admin command-center panel). Requires {@link LiquidGlassDefs}
 * to be mounted once at the app root. `draggable` enables a lightweight
 * pointer-drag (no motion dependency).
 */
export function LiquidGlassCard({
  children,
  className,
  contentClassName,
  borderRadius = '32px',
  blurIntensity = 'xl',
  glowIntensity = 'sm',
  shadowIntensity = 'md',
  softer = false,
  draggable = false,
  style,
}: {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  borderRadius?: string;
  blurIntensity?: BlurIntensity;
  glowIntensity?: GlowIntensity;
  shadowIntensity?: ShadowIntensity;
  softer?: boolean;
  draggable?: boolean;
  style?: CSSProperties;
}) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const drag = useRef<{ id: number; cx: number; cy: number; ox: number; oy: number } | null>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!draggable || e.button !== 0) return;
      drag.current = { id: e.pointerId, cx: e.clientX, cy: e.clientY, ox: pos.x, oy: pos.y };
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    },
    [draggable, pos.x, pos.y],
  );

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    setPos({ x: d.ox + (e.clientX - d.cx), y: d.oy + (e.clientY - d.cy) });
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current || drag.current.id !== e.pointerId) return;
    drag.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <div
      className={cn('relative isolate', draggable && 'cursor-grab touch-none active:cursor-grabbing', className)}
      style={{
        borderRadius,
        ...(draggable ? { transform: `translate(${pos.x}px, ${pos.y}px)` } : null),
        ...style,
      }}
      onPointerDown={draggable ? onPointerDown : undefined}
      onPointerMove={draggable ? onPointerMove : undefined}
      onPointerUp={draggable ? onPointerUp : undefined}
      onPointerCancel={draggable ? onPointerUp : undefined}
    >
      <LiquidGlassLayers
        borderRadius={borderRadius}
        blurIntensity={blurIntensity}
        glowIntensity={glowIntensity}
        shadowIntensity={shadowIntensity}
        softer={softer}
      />
      <div className={cn('relative z-10', contentClassName)}>{children}</div>
    </div>
  );
}
