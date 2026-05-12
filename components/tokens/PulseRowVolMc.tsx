'use client';

import { NumberDisplay } from '@/components/shared/NumberDisplay';
import { cn } from '@/lib/utils/cn';

/** Axiom-style: grey `V` + white value, grey `MC` + cyan value, one baseline. */
export function PulseRowVolMc({
  vol,
  mcUsd,
  showVol,
  showMc,
  size = 'normal',
  className,
  justify = 'end',
  layout = 'inline',
}: {
  vol: number | null | undefined;
  mcUsd: number | null | undefined;
  showVol: boolean;
  showMc: boolean;
  size?: 'compact' | 'normal' | 'expanded' | 'prominent';
  className?: string;
  justify?: 'start' | 'end';
  /** Pulse “small” preset: stack MC above V so the row stays narrow beside quick-buy. */
  layout?: 'inline' | 'stack';
}) {
  if (!showVol && !showMc) return null;

  /**
   * Polish spec C: uniform typography for label + value pairs.
   * `size` prop kept for signature stability but no longer drives styling.
   */
  const labelCls = 'text-[10px] font-medium uppercase tracking-wider text-fg-muted';
  const valueCls = 'text-sm font-semibold text-fg-primary';

  const volBlock = showVol ? (
    <span className="inline-flex shrink-0 items-baseline gap-1">
      <span className={labelCls}>V</span>
      <NumberDisplay value={vol} compact className={valueCls} />
    </span>
  ) : null;

  const mcBlock = showMc ? (
    <span className="inline-flex shrink-0 items-baseline gap-1">
      <span className={labelCls}>MC</span>
      <NumberDisplay value={mcUsd} compact className={valueCls} />
    </span>
  ) : null;

  if (layout === 'stack') {
    return (
      <div
        className={cn(
          'flex max-w-full flex-col items-end gap-0.5 font-sans leading-none tracking-tight',
          className,
        )}
      >
        {mcBlock}
        {volBlock}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'inline-flex max-w-full flex-nowrap items-baseline gap-x-3 font-sans leading-none tracking-tight',
        justify === 'end' && 'justify-end',
        className,
      )}
    >
      {volBlock}
      {mcBlock}
    </div>
  );
}
