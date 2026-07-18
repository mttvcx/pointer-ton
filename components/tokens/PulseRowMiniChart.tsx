'use client';

import { useId, useMemo } from 'react';

type Props = {
  /** Real observed prices (oldest → newest). Renders nothing below 2 points. */
  series: number[];
  /** Chart height as a % of the row (10–100). */
  size: number;
  /** Overall alpha (0–100). */
  opacity: number;
  /** Horizontal edge fade (0–100). */
  edgeFade: number;
};

const VB_W = 100;
const VB_H = 100;

/**
 * Axiom-style faint price sparkline drawn as a row background. Purely decorative:
 * `pointer-events-none`, anchored bottom, stretched to fill via a non-uniform
 * viewBox. Green when the window closed up, red when down. Fed by real observed
 * prices — see store/pulseMiniChartSeries.
 */
export function PulseRowMiniChart({ series, size, opacity, edgeFade }: Props) {
  const gid = useId().replace(/[:]/g, '');

  const geom = useMemo(() => {
    if (series.length < 2) return null;
    const first = series[0];
    const last = series[series.length - 1];
    if (first == null || last == null) return null;
    let min = Infinity;
    let max = -Infinity;
    for (const v of series) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
    const span = max - min || 1;
    const n = series.length;
    const pts = series.map((v, i) => {
      const x = (i / (n - 1)) * VB_W;
      // Leave a hair of headroom (8%) so the peak isn't clipped by the stroke.
      const y = VB_H - 6 - ((v - min) / span) * (VB_H - 12);
      return [x, y] as const;
    });
    const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`).join(' ');
    const area = `${line} L${VB_W} ${VB_H} L0 ${VB_H} Z`;
    const up = last >= first;
    return { line, area, up };
  }, [series]);

  if (!geom) return null;

  const color = geom.up ? 'var(--signal-bull-rgb, 16 185 129)' : 'var(--signal-bear-rgb, 239 68 68)';
  const stroke = `rgb(${color})`;
  const height = Math.max(10, Math.min(100, size));
  const fadeInset = (Math.max(0, Math.min(100, edgeFade)) / 100) * 32; // up to 32% inset per side
  const mask =
    fadeInset > 0.5
      ? `linear-gradient(90deg, transparent 0%, #000 ${fadeInset}%, #000 ${100 - fadeInset}%, transparent 100%)`
      : undefined;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 bottom-0 z-0 overflow-hidden"
      style={{
        height: `${height}%`,
        opacity: Math.max(0, Math.min(100, opacity)) / 100,
        WebkitMaskImage: mask,
        maskImage: mask,
      }}
    >
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="none"
        className="h-full w-full"
      >
        <defs>
          <linearGradient id={`mcArea-${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={geom.area} fill={`url(#mcArea-${gid})`} />
        <path
          d={geom.line}
          fill="none"
          stroke={stroke}
          strokeWidth={1.5}
          strokeOpacity={0.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}
