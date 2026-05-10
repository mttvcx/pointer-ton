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

  const labelCls =
    size === 'compact'
      ? 'text-[10px] font-medium text-fg-muted/80'
      : size === 'expanded'
        ? 'text-[12px] font-medium text-fg-muted/80'
        : size === 'prominent'
          ? 'text-[12px] font-semibold text-fg-muted/85 sm:text-[13px]'
          : 'text-[11px] font-medium text-fg-muted/80';
  const valueVolCls =
    size === 'compact'
      ? 'text-[11px]'
      : size === 'expanded'
        ? 'text-[15px]'
        : size === 'prominent'
          ? 'text-[15px] font-semibold sm:text-[16px]'
          : 'text-[13px]';
  const valueMcCls = valueVolCls;

  /** Tight horizontal rhythm (Axiom-like): labels stay adjacent without flex squeeze from buy overlay */
  const gapCls =
    size === 'compact'
      ? 'gap-x-2.5'
      : size === 'expanded'
        ? 'gap-x-5'
        : size === 'prominent'
          ? 'gap-x-4 sm:gap-x-5'
          : 'gap-x-3';

  const volBlock = showVol ? (
    <span className="inline-flex shrink-0 items-baseline gap-1">
      <span className={labelCls}>V</span>
      <NumberDisplay
        value={vol}
        compact
        className={cn('font-medium text-fg-primary', valueVolCls)}
      />
    </span>
  ) : null;

  const mcBlock = showMc ? (
    <span className="inline-flex shrink-0 items-baseline gap-1">
      <span className={labelCls}>MC</span>
      <NumberDisplay
        value={mcUsd}
        compact
        className={cn('font-medium text-[#70C0E8]', valueMcCls)}
      />
    </span>
  ) : null;

  if (layout === 'stack') {
    return (
      <div
        className={cn(
          'flex max-w-full flex-col items-end gap-0.5 font-sans tabular-nums leading-none tracking-tight',
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
        'inline-flex max-w-full flex-nowrap items-baseline font-sans tabular-nums leading-none tracking-tight',
        gapCls,
        justify === 'end' && 'justify-end',
        className,
      )}
    >
      {volBlock}
      {mcBlock}
    </div>
  );
}
