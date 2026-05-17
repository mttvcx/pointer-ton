'use client';

/**
 * Shared primitives for the four Task AA discovery cards
 * (TraderHeroCard, TraderCompactRow, SquadHeroCard, SquadCompactRow).
 * Pulled out so the formatter / sparkline / stat block stay consistent.
 */

import { cn } from '@/lib/utils/cn';

export function formatCurrency(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

export function HeroStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <span className="text-[9px] font-semibold uppercase tracking-wider text-fg-muted">
        {label}
      </span>
      <span
        className={cn(
          'text-sm font-semibold tabular-nums',
          accent ? 'text-accent-ethos' : 'text-fg-primary',
        )}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * Minimal inline SVG sparkline. Colors itself green / red based on the
 * `positive` flag so cards can match the headline PnL tint.
 */
export function HeroSparkline({
  values,
  positive,
}: {
  values: number[];
  positive: boolean;
}) {
  if (!values.length) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 80;
  const h = 24;
  const step = w / (values.length - 1 || 1);
  const points = values
    .map((v, i) => {
      const x = i * step;
      const y = h - ((v - min) / range) * h;
      return `${x},${y}`;
    })
    .join(' ');
  const stroke = positive ? 'rgb(var(--signal-bull-rgb) / 1)' : 'rgb(var(--signal-bear-rgb) / 1)';
  return (
    <svg width={w} height={h} className="shrink-0" aria-hidden>
      <polyline points={points} fill="none" stroke={stroke} strokeWidth={1.5} />
    </svg>
  );
}
