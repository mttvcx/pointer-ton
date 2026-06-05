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
        'pointer-events-none absolute inset-x-0 bottom-full z-[12] mb-0.5 hidden h-0 group-hover/pulseRow:block',
        className,
      )}
      aria-hidden
    >
      <span
        className={cn(
          'absolute bottom-0 whitespace-nowrap rounded-md border border-white/[0.1]',
          'bg-bg-raised px-2 py-0.5 text-[10px] font-medium leading-none text-signal-bull',
          'transition-[left] duration-200 ease-linear',
        )}
        style={{ left: `${pct}%`, transform: 'translateX(-50%)' }}
      >
        {label}
      </span>
    </div>
  );
}
