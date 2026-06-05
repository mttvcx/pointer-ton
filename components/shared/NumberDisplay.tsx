'use client';

import { cn } from '@/lib/utils/cn';
import { formatCompactUsd } from '@/lib/utils/formatters';

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
    return <span className={cn('tabular-nums', className)}>{formatCompactUsd(value)}</span>;
  }
  return (
    <span className={cn('tabular-nums', className)}>
      {value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })}
    </span>
  );
}
