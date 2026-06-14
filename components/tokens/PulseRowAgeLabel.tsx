'use client';

import { memo } from 'react';
import { useLiveClock } from '@/lib/hooks/useLiveClock';
import { formatAgeShort } from '@/lib/format';
import { cn } from '@/lib/utils/cn';

/** Isolated age chip — only this subscribes to the shared live clock, not the whole row. */
export const PulseRowAgeLabel = memo(function PulseRowAgeLabel({
  createdAt,
  compact,
  rowAlign,
}: {
  createdAt: string;
  compact?: boolean;
  /** Pulse icon strip — lock to the same 24px row height as sibling glyphs. */
  rowAlign?: boolean;
}) {
  const now = useLiveClock();
  const ageLabel = formatAgeShort(createdAt, now);
  const ms = new Date(createdAt).getTime();
  const isFreshListing = Number.isFinite(ms) && now - ms < 60_000;

  return (
    <span
      className={cn(
        'shrink-0 whitespace-nowrap leading-none',
        rowAlign && 'inline-flex h-6 items-center',
        compact ? 'text-[13px]' : 'text-xs',
        isFreshListing ? 'font-medium text-signal-bull' : 'text-fg-muted',
      )}
    >
      {ageLabel}
    </span>
  );
});
