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
}: {
  vol: number | null | undefined;
  mcUsd: number | null | undefined;
  showVol: boolean;
  showMc: boolean;
  size?: 'compact' | 'normal' | 'expanded';
  className?: string;
  justify?: 'start' | 'end';
}) {
  if (!showVol && !showMc) return null;

  const labelCls =
    size === 'compact'
      ? 'text-[10px] font-medium text-fg-muted/80'
      : size === 'expanded'
        ? 'text-[12px] font-medium text-fg-muted/80'
        : 'text-[11px] font-medium text-fg-muted/80';
  const valueVolCls =
    size === 'compact' ? 'text-[11px]' : size === 'expanded' ? 'text-[15px]' : 'text-[13px]';
  const valueMcCls = valueVolCls;

  const gapCls = size === 'compact' ? 'gap-x-4' : size === 'expanded' ? 'gap-x-7' : 'gap-x-6';

  return (
    <div
      className={cn(
        'inline-flex max-w-full flex-nowrap items-baseline font-sans tabular-nums leading-none tracking-tight',
        gapCls,
        justify === 'end' && 'justify-end',
        className,
      )}
    >
      {showVol ? (
        <span className="inline-flex shrink-0 items-baseline gap-1">
          <span className={labelCls}>V</span>
          <NumberDisplay
            value={vol}
            compact
            className={cn('font-medium text-fg-primary', valueVolCls)}
          />
        </span>
      ) : null}
      {showMc ? (
        <span className="inline-flex shrink-0 items-baseline gap-1">
          <span className={labelCls}>MC</span>
          <NumberDisplay
            value={mcUsd}
            compact
            className={cn('font-medium text-[#70C0E8]', valueMcCls)}
          />
        </span>
      ) : null}
    </div>
  );
}
