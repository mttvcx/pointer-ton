'use client';

import { cn } from '@/lib/utils/cn';

/** Axiom-style inline Share PnL — green text, minimal chrome. */
export function TokenSharePnlButton({
  onClick,
  className,
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-sm px-0.5 text-[11px] font-medium leading-none text-signal-bull transition-colors hover:text-signal-bull/80',
        className,
      )}
      aria-label="Share PnL"
    >
      <svg
        viewBox="0 0 16 16"
        width="12"
        height="12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        className="shrink-0"
      >
        <path d="M8 10V2" />
        <path d="M5.5 4.5 8 2l2.5 2.5" />
        <path d="M3 14h10" />
      </svg>
      Share PnL
    </button>
  );
}
