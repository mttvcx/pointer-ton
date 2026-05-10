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
    <button
      type="button"
      title="Share PnL"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        'focus-ring inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-transparent text-fg-muted transition hover:border-border-subtle hover:bg-bg-hover hover:text-accent-primary',
        className,
      )}
    >
      <Share className="h-4 w-4" strokeWidth={2} />
      <span className="sr-only">Share PnL</span>
    </button>
  );
}
