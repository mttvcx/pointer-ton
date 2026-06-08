'use client';

import { cn } from '@/lib/utils/cn';

/**
 * Axiom-style row hover tag: "Bonding: 12.34%" slides along the metric strip
 * as the curve fills (left = 0%, right = ~100%).
 */
export function PulseRowBondingHoverTag({
  fillPct,
  migrated,
  className,
}: {
  fillPct: number | null;
  migrated: boolean;
  className?: string;
}) {
  if (migrated || fillPct == null || !Number.isFinite(fillPct)) return null;

  const pct = Math.min(100, Math.max(0, fillPct));
  const label = `Bonding: ${pct.toFixed(2)}%`;

  return (
    <div
      className={cn(
        /**
         * Only visible while hovering the metric-chip strip — never on name/social hovers.
         * Stays above the pills (Axiom-style), not over them or other row popovers.
         */
        'pointer-events-none absolute inset-x-0 bottom-full z-[6] mb-2 hidden h-0',
        'group-hover/metricStrip:block',
        'group-has-[[data-popover-open=true]]/pulseRow:!hidden',
        className,
      )}
      aria-hidden
    >
      <span
        className="absolute bottom-0 -translate-x-1/2"
        style={{ left: `${pct}%` }}
      >
        <span
          className={cn(
            'block whitespace-nowrap rounded-md border border-white/[0.1]',
            'bg-bg-raised px-2 py-0.5 text-[10px] font-medium leading-none text-signal-bull shadow-panel',
            'transition-[opacity,transform] duration-150 ease-out',
            'opacity-0 translate-y-0.5 group-hover/metricStrip:opacity-100 group-hover/metricStrip:translate-y-0',
          )}
        >
          {label}
        </span>
      </span>
    </div>
  );
}
