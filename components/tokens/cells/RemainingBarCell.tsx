'use client';

import { cn } from '@/lib/utils/cn';

export type RemainingBarCellProps = {
  usdLabel: string;
  pct: number;
  className?: string;
};

export function RemainingBarCell({ usdLabel, pct, className }: RemainingBarCellProps) {
  const clamped = Math.max(0, Math.min(100, pct));
  const isHolding = clamped > 0.5;

  return (
    <div className={cn('relative flex h-full min-h-[2.25rem] w-full items-center justify-end', className)}>
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-y-1 left-0 rounded-sm',
          isHolding ? 'bg-accent-primary/20' : 'bg-fg-muted/15',
        )}
        style={{
          width: `${clamped}%`,
          maskImage: 'linear-gradient(to right, black 70%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to right, black 70%, transparent 100%)',
        }}
      />
      <div className="relative z-10 flex items-center gap-1.5 px-1.5">
        <span className="text-[12px] font-medium font-sans tabular-nums text-fg-primary">
          {usdLabel}
        </span>
        <span
          className={cn(
            'rounded-sm px-1 py-px text-[10px] font-medium font-sans tabular-nums',
            isHolding
              ? 'bg-accent-primary/15 text-accent-primary'
              : 'bg-fg-muted/15 text-fg-muted',
          )}
        >
          {clamped.toFixed(clamped < 10 ? 2 : 1)}%
        </span>
      </div>
    </div>
  );
}
