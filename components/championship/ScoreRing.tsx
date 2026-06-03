'use client';

import { formatNumber } from '@/lib/utils/formatters';
import { cn } from '@/lib/utils/cn';

export interface ScoreRingSegment {
  id: string;
  label: string;
  value: number;
  color: string;
}

interface ScoreRingProps {
  total: number;
  segments: ScoreRingSegment[];
  size?: number;
  className?: string;
}

const SEGMENT_GAP = 0.018;

export function ScoreRing({ total, segments, size = 156, className }: ScoreRingProps) {
  const stroke = 16;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const c = 2 * Math.PI * r;
  const positive = segments.filter((s) => s.value > 0);
  const sum = positive.reduce((s, seg) => s + seg.value, 0);
  const safeTotal = sum > 0 ? sum : 1;
  const usable = c * (1 - positive.length * SEGMENT_GAP);

  let offset = 0;

  return (
    <div className={cn('relative inline-flex shrink-0 items-center justify-center', className)}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="drop-shadow-[0_0_18px_rgb(var(--accent-primary-rgb)/0.25)]"
        aria-hidden
      >
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="rgb(var(--border-subtle-rgb) / 0.25)"
          strokeWidth={stroke}
        />
        {positive.map((seg) => {
          const len = (seg.value / safeTotal) * usable;
          const dash = `${Math.max(0, len)} ${c}`;
          const el = (
            <circle
              key={seg.id}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth={stroke}
              strokeDasharray={dash}
              strokeDashoffset={-offset}
              strokeLinecap="round"
              transform={`rotate(-90 ${cx} ${cy})`}
              className="transition-all duration-500"
            />
          );
          offset += len + c * SEGMENT_GAP;
          return el;
        })}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="font-mono text-[1.65rem] font-black tabular-nums leading-none tracking-tight text-fg-primary">
          {formatNumber(total, { decimals: 0 })}
        </span>
        <span className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-accent-primary">PTCS</span>
      </div>
    </div>
  );
}

interface ScoreLegendProps {
  segments: ScoreRingSegment[];
  total: number;
  layout?: 'stack' | 'inline';
}

export function ScoreLegend({ segments, total, layout = 'stack' }: ScoreLegendProps) {
  const safeTotal = total > 0 ? total : 1;
  return (
    <ul className={cn(layout === 'inline' ? 'flex flex-wrap gap-x-4 gap-y-2' : 'space-y-2')}>
      {segments.map((seg) => {
        const pct = Math.round((Math.max(0, seg.value) / safeTotal) * 100);
        if (seg.value <= 0) return null;
        return (
          <li key={seg.id} className="flex items-center gap-2">
            <span
              className="h-2 w-2 shrink-0 rounded-full shadow-[0_0_8px_currentColor]"
              style={{ backgroundColor: seg.color, color: seg.color }}
              aria-hidden
            />
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wide text-fg-muted">{seg.label}</p>
              <p className="font-mono text-xs tabular-nums text-fg-primary">
                {formatNumber(seg.value, { decimals: 0 })}
                <span className="text-fg-muted"> · {pct}%</span>
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
