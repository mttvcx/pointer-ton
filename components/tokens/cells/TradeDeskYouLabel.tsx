'use client';

import { Crown } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

/** Axiom-style yellow "YOU" when the trade row is the viewer's wallet. */
export function TradeDeskYouLabel({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-0.5 font-sans text-[11px] font-bold uppercase tracking-wide text-signal-warn',
        className,
      )}
    >
      <Crown className="h-3 w-3 shrink-0" strokeWidth={2.25} aria-hidden />
      YOU
    </span>
  );
}
