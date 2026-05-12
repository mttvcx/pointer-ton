'use client';

import { useId } from 'react';
import { cn } from '@/lib/utils/cn';

/**
 * Lightweight SVG sparkline — no deps, GPU-friendly scaling.
 */
export function PredictionMarketMiniChart({
  values,
  className,
  emphasize,
}: {
  values: number[];
  className?: string;
  /** Brighten stroke on hover parent */
  emphasize?: boolean;
}) {
  const uid = useId().replace(/:/g, '');
  const gradId = `pm-spark-${uid}`;
  const w = 44;
  const h = 16;
  if (values.length < 2) return null;

  let min = Math.min(...values);
  let max = Math.max(...values);
  if (max === min) {
    min -= 0.05;
    max += 0.05;
  }
  const pad = 1;
  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (w - pad * 2);
    const t = (v - min) / (max - min);
    const y = h - pad - t * (h - pad * 2);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const d = `M ${pts.join(' L ')}`;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={cn(
        'shrink-0 overflow-visible opacity-50 transition-opacity duration-300',
        emphasize && 'opacity-95',
        className,
      )}
      width={w}
      height={h}
      aria-hidden
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(94,187,255,0.05)" />
          <stop offset="50%" stopColor="rgba(94,187,255,0.35)" />
          <stop offset="100%" stopColor="rgba(94,187,255,0.08)" />
        </linearGradient>
      </defs>
      <path
        d={d}
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth={1.25}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
