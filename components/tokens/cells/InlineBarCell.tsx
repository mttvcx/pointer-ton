'use client';

import { cn } from '@/lib/utils/cn';

type Tone = 'buy' | 'sell' | 'neutral';

export type InlineBarCellProps = {
  value: number;
  max: number;
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
};

const barToneClass: Record<Tone, string> = {
  buy: 'bg-signal-bull/10',
  sell: 'bg-signal-bear/10',
  neutral: 'bg-fg-muted/10',
};

const textToneClass: Record<Tone, string> = {
  buy: 'text-signal-bull',
  sell: 'text-signal-bear',
  neutral: 'text-fg-secondary',
};

export function InlineBarCell({
  value,
  max,
  tone = 'neutral',
  children,
  className,
}: InlineBarCellProps) {
  const pct = max > 0 ? Math.min(100, (Math.abs(value) / max) * 100) : 0;

  return (
    <div className={cn('relative block h-full w-full min-h-9 pointer-events-none', className)}>
      <div
        aria-hidden
        className={cn('pointer-events-none absolute inset-y-0 left-0', barToneClass[tone])}
        style={{ width: `${pct}%` }}
      />
      <div
        className={cn(
          'pointer-events-auto relative z-10 flex h-full items-center gap-0.5 pl-2 pr-1',
          textToneClass[tone],
        )}
      >
        <span className="inline-flex items-center gap-0.5 text-[11px] font-normal font-mono tabular-nums leading-none">
          {children}
        </span>
      </div>
    </div>
  );
}
