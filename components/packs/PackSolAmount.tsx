'use client';

import { SpotTickerIcon } from '@/components/chains/SpotTickerIcon';
import { cn } from '@/lib/utils/cn';

/** SOL-denominated price with chain mark — no "SOL" text. */
export function PackSolAmount({
  amount,
  size = 'md',
  className,
}: {
  amount: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const iconPx = size === 'lg' ? 18 : size === 'md' ? 14 : 12;
  const text = size === 'lg' ? 'text-xl' : size === 'md' ? 'text-base' : 'text-sm';

  return (
    <span className={cn('inline-flex items-center gap-1.5 font-mono font-semibold tabular-nums', text, className)}>
      <span>{amount}</span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/chains/sol.png"
        alt=""
        width={iconPx}
        height={iconPx}
        draggable={false}
        className="inline-block shrink-0 object-contain"
        style={{ width: iconPx, height: iconPx }}
      />
    </span>
  );
}

export function PackSolIcon({ size = 14, className }: { size?: number; className?: string }) {
  return <SpotTickerIcon symbol="SOL" className={className} />;
}
