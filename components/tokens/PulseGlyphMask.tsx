'use client';

import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils/cn';

const GLYPH_BASE = '/pulse-glyphs';

export const PULSE_GLYPH = {
  profile: `${GLYPH_BASE}/profile.png`,
  globe: `${GLYPH_BASE}/globe.png`,
  telegram: `${GLYPH_BASE}/telegram.png`,
  pump: `${GLYPH_BASE}/pump.png`,
  search: `${GLYPH_BASE}/search.png`,
  community: `${GLYPH_BASE}/community.png`,
  chart: `${GLYPH_BASE}/chart.png`,
  trophy: `${GLYPH_BASE}/trophy.png`,
  crown: `${GLYPH_BASE}/crown.png`,
  xLogo: `${GLYPH_BASE}/x_logo.png`,
  feather: `${GLYPH_BASE}/feather.png`,
  cashback: `${GLYPH_BASE}/cashback.png`,
  feeShare: `${GLYPH_BASE}/fee_share.png`,
  agent: `${GLYPH_BASE}/agent.png`,
} as const;

export const PULSE_INSTAGRAM_SRC = `${GLYPH_BASE}/instagram.png`;

export const PULSE_BRAND_SRC = {
  github: `${GLYPH_BASE}/github.png`,
  youtube: `${GLYPH_BASE}/youtube.png`,
  tiktok: `${GLYPH_BASE}/tiktok.png`,
  communities: `${GLYPH_BASE}/communities_alt.png`,
} as const;

function luminanceMaskStyle(src: string, size: number): CSSProperties {
  return {
    width: size,
    height: size,
    maskImage: `url("${src}")`,
    WebkitMaskImage: `url("${src}")`,
    maskSize: 'contain',
    WebkitMaskSize: 'contain',
    maskRepeat: 'no-repeat',
    WebkitMaskRepeat: 'no-repeat',
    maskPosition: 'center',
    WebkitMaskPosition: 'center',
    maskMode: 'luminance',
    // Safari: prefer luminance over alpha for opaque PNGs (else the whole tile is solid).
    WebkitMaskSourceType: 'luminance',
  } as CSSProperties;
}

/**
 * Mono strip icons: PNG black plate must never be painted. Luminance mask + `bg-current`
 * inherits the parent's text color so the row's `text-fg-muted` → `hover:text-fg-secondary`
 * cascade drives icon color uniformly (per Pulse polish spec D).
 */
export function PulseLuminanceGlyph({
  src,
  size,
  className,
}: {
  src: string;
  size: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'pointer-events-none inline-block shrink-0 border-0 bg-current ring-0',
        'transition-colors duration-100 ease-out',
        className,
      )}
      style={luminanceMaskStyle(src, size)}
      aria-hidden
    />
  );
}

type GlyphKey = keyof typeof PULSE_GLYPH;

/**
 * mono: white-ish via luminance mask (no blend, no filter-on-black bugs).
 * natural: full-color img; black plate removed with mix-blend-lighten only (no brightness filter).
 */
export function PulseGlyphMask({
  name,
  className,
  size = 24,
  variant = 'mono',
}: {
  name: GlyphKey;
  className?: string;
  size?: number;
  variant?: 'mono' | 'natural';
}) {
  const src = PULSE_GLYPH[name];

  if (variant === 'mono') {
    return <PulseLuminanceGlyph src={src} size={size} className={className} />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      draggable={false}
      aria-hidden
      className={cn(
        'pointer-events-none shrink-0 border-0 object-contain ring-0 mix-blend-lighten',
        'transition-[filter] duration-100 ease-out group-hover:brightness-110',
        className,
      )}
      style={{ width: size, height: size }}
    />
  );
}
