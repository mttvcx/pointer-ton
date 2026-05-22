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
        'pointer-events-none absolute inset-x-0 bottom-full z-[12] mb-1.5 h-0',
        'opacity-0 transition-opacity duration-150 group-hover/pulseRow:opacity-100',
        className,
      )}
      aria-hidden
    >
      <span
        className={cn(
          'absolute bottom-0 whitespace-nowrap rounded-md border border-white/[0.08]',
          'bg-[#1a1a1a]/95 px-2.5 py-1 text-[11px] font-medium leading-none text-signal-bull shadow-lg shadow-black/50',
          'transition-[left] duration-200 ease-linear will-change-[left]',
        )}
        style={{ left: `${pct}%`, transform: 'translateX(-50%)' }}
      >
        {label}
      </span>
    </div>
  );
}
