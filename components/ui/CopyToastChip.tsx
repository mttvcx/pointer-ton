'use client';

import type { CSSProperties, MouseEventHandler } from 'react';
import { Clipboard } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

/** Matches Sonner success copy toast — solid terminal card, bull border, clipboard icon. */
export function CopyToastChip({
  mint,
  className,
  style,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: {
  mint: string;
  className?: string;
  style?: CSSProperties;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  onMouseEnter?: MouseEventHandler<HTMLButtonElement>;
  onMouseLeave?: MouseEventHandler<HTMLButtonElement>;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={cn(
        'pointer-events-auto flex max-w-[min(28rem,calc(100vw-2rem))] items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left shadow-lg',
        'border-[rgb(var(--signal-bull-rgb)/0.45)] bg-bg-base',
        'animate-in fade-in zoom-in-95 duration-100',
        className,
      )}
      style={style}
    >
      <Clipboard className="mt-0.5 h-4 w-4 shrink-0 text-accent-primary" strokeWidth={2.25} aria-hidden />
      <span className="min-w-0 text-[13px] font-medium leading-snug text-signal-bull">
        <span className="text-signal-bull">Copy </span>
        <span className="break-all font-normal tabular-nums text-fg-primary">{mint}</span>
      </span>
    </button>
  );
}
