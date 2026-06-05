'use client';

import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils/cn';
import { formatCompactUsd } from '@/lib/utils/formatters';

/** Compact readout for MC / USD amounts on Pulse rows. */
export function NumberDisplay({
  value,
  className,
  compact,
  style,
}: {
  value: number | null | undefined;
  className?: string;
  compact?: boolean;
  style?: CSSProperties;
}) {
  if (value == null || !Number.isFinite(value)) {
    return <span className={cn('tabular-nums text-fg-muted', className)} style={style}>--</span>;
  }
  if (compact) {
    return (
      <span className={cn('tabular-nums', className)} style={style}>
        {formatCompactUsd(value)}
      </span>
    );
  }
  return (
    <span className={cn('tabular-nums', className)} style={style}>
      {value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })}
    </span>
  );
}
