'use client';

import { NumberDisplay } from '@/components/shared/NumberDisplay';
import { cn } from '@/lib/utils/cn';

/** Axiom-style: grey `V` + white value, grey `MC` + cyan value (gold on migrated), one baseline. */
export function PulseRowVolMc({
  vol,
  mcUsd,
  showVol,
  showMc,
  size = 'normal',
  className,
  justify = 'end',
  layout = 'inline',
  mcTone = 'cyan',
  volColor,
  mcColor,
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
  /** MC value tint: cyan for pre-migration (new/stretch), gold for migrated tokens. */
  mcTone?: 'cyan' | 'gold';
  /** Metric-band override (Display → Metrics, when Color row is on). */
  volColor?: string;
  mcColor?: string;
}) {
  if (!showVol && !showMc) return null;

  /**
   * Axiom typography: uniform size on every row (tabular-nums + fixed text size),
   * V value white, MC value tinted cyan (pre-migration) or gold (post-migration).
   * `size` prop kept for signature stability but no longer drives styling.
   */
  const labelCls = 'text-[11px] font-medium uppercase tracking-wider text-fg-muted';
  const valueBase = 'text-[15px] font-semibold tabular-nums leading-none';
  const volValueCls = `${valueBase} ${volColor ? '' : 'text-fg-primary'}`;
  const mcValueCls = `${valueBase} ${
    mcColor ? '' : mcTone === 'gold' ? 'text-amber-400' : 'text-cyan-400'
  }`;

  const volBlock = showVol ? (
    <span className="inline-flex shrink-0 items-baseline gap-1">
      <span className={labelCls}>V</span>
      <NumberDisplay
        value={vol}
        compact
        className={volValueCls}
        style={volColor ? { color: volColor } : undefined}
      />
    </span>
  ) : null;

  const mcBlock = showMc ? (
    <span className="inline-flex shrink-0 items-baseline gap-1">
      <span className={labelCls}>MC</span>
      <NumberDisplay
        value={mcUsd}
        compact
        className={mcValueCls}
        style={mcColor ? { color: mcColor } : undefined}
      />
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
