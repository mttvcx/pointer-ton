'use client';

import { cn } from '@/lib/utils/cn';

/** Compact readout for MC / USD amounts on Pulse rows. */
export function NumberDisplay({
  value,
  className,
  compact,
}: {
  value: number | null | undefined;
  className?: string;
  compact?: boolean;
}) {
  if (value == null || !Number.isFinite(value)) {
    return <span className={cn('tabular-nums text-fg-muted', className)}>--</span>;
  }
  if (compact) {
    const abs = Math.abs(value);
    const sign = value < 0 ? '-' : '';
    if (abs >= 1_000_000_000) return <span className={cn('tabular-nums', className)}>{sign}${(abs / 1_000_000_000).toFixed(2)}B</span>;
    if (abs >= 1_000_000) return <span className={cn('tabular-nums', className)}>{sign}${(abs / 1_000_000).toFixed(2)}M</span>;
    if (abs >= 1_000) return <span className={cn('tabular-nums', className)}>{sign}${(abs / 1_000).toFixed(1)}K</span>;
    return <span className={cn('tabular-nums', className)}>{sign}${abs.toFixed(2)}</span>;
  }
  return (
    <span className={cn('tabular-nums', className)}>
      {value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })}
    </span>
  );
}
