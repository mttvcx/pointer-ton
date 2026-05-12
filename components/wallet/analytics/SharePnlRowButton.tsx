'use client';

import { Share } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export function SharePnlRowButton({
  onClick,
  className,
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <span className="group/share relative inline-flex">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        className={cn(
          'focus-ring inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-transparent text-fg-muted transition hover:border-white/[0.1] hover:bg-white/[0.04] hover:text-fg-primary',
          className,
        )}
      >
        <Share className="h-3.5 w-3.5" strokeWidth={1.9} />
        <span className="sr-only">Share PnL</span>
      </button>
      <span className="pointer-events-none absolute right-0 top-[calc(100%+6px)] z-10 whitespace-nowrap rounded border border-white/[0.08] bg-[#080a0e] px-2 py-1 text-[10px] font-medium text-fg-secondary opacity-0 shadow-lg transition group-hover/share:opacity-100">
        Share PNL
      </span>
    </span>
  );
}
