import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export interface StatItem {
  label: string;
  value: ReactNode;
  /** Optional tint - bull/bear/warn/info - for the value text. */
  tone?: 'default' | 'bull' | 'bear' | 'warn' | 'info' | 'accent';
  /** Hover tooltip on the cell. */
  title?: string;
}

const TONE: Record<NonNullable<StatItem['tone']>, string> = {
  default: 'text-fg-primary',
  bull: 'text-signal-bull',
  bear: 'text-signal-bear',
  warn: 'text-signal-warn',
  info: 'text-signal-info',
  accent: 'text-accent-primary',
};

/**
 * Horizontal stat bar inspired by Bloomberg / Axiom token headers. Renders a
 * single row of label-over-value cells separated by hairlines. Wraps to two
 * rows on narrow screens.
 */
export function StatStrip({
  items,
  className,
  dense = false,
}: {
  items: StatItem[];
  className?: string;
  dense?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex flex-nowrap divide-x divide-border-subtle overflow-x-auto border-b border-border-subtle bg-bg-base',
        className,
      )}
    >
      {items.map((it) => (
        <div
          key={it.label}
          title={it.title}
          className={cn(
            'min-w-[100px] flex-1 shrink-0 px-3',
            dense ? 'py-1' : 'py-1.5',
          )}
        >
          <div className="text-[10px] font-medium uppercase tracking-wide text-fg-muted">
            {it.label}
          </div>
          <div
            className={cn(
              'mt-0.5 tabular-nums tabular-nums',
              dense ? 'text-xs' : 'text-sm',
              TONE[it.tone ?? 'default'],
            )}
          >
            {it.value}
          </div>
        </div>
      ))}
    </div>
  );
}
