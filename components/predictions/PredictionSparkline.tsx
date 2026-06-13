'use client';

import { useId } from 'react';
import { cn } from '@/lib/utils/cn';

export function PredictionSparkline({
  values,
  className,
  width = 56,
  height = 22,
}: {
  values: number[];
  className?: string;
  width?: number;
  height?: number;
}) {
  const uid = useId().replace(/:/g, '');
  const gradId = `kalshi-spark-${uid}`;
  if (values.length < 2) return null;

  let min = Math.min(...values);
  let max = Math.max(...values);
  if (max === min) {
    min -= 0.05;
    max += 0.05;
  }
  const pad = 1;
  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (width - pad * 2);
    const t = (v - min) / (max - min);
    const y = height - pad - t * (height - pad * 2);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={cn('shrink-0', className)}
      aria-hidden
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(52,211,153,0.08)" />
          <stop offset="50%" stopColor="rgba(52,211,153,0.45)" />
          <stop offset="100%" stopColor="rgba(52,211,153,0.1)" />
        </linearGradient>
      </defs>
      <path
        d={`M ${pts.join(' L ')}`}
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth={1.35}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
