'use client';

import { MousePointer2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

const PREVIEW_FRAME =
  'box-border max-w-full overflow-hidden rounded-md border border-white/[0.08] bg-[#0c0c0e]';

/** Mini diagram: Pointer → parallel routes → validator stacks. */
export function BlitzLandingPreview({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        PREVIEW_FRAME,
        'flex aspect-[5/3] w-full items-center justify-between gap-3 px-4 py-3',
        className,
      )}
      aria-hidden
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-accent-primary/40 bg-accent-primary/15 text-accent-primary shadow-[0_0_18px_rgb(var(--accent-primary-rgb)/0.18)]">
        <MousePointer2 className="h-4 w-4" strokeWidth={2.25} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5 px-1">
        {[0.45, 0.65, 0.85].map((opacity) => (
          <div
            key={opacity}
            className="h-px w-full rounded-full bg-accent-primary/40"
            style={{ opacity, marginLeft: `${(1 - opacity) * 12}%` }}
          />
        ))}
      </div>

      <div className="flex shrink-0 gap-1">
        {[0.55, 0.72, 0.88, 1].map((opacity, i) => (
          <div
            key={i}
            className="flex h-9 w-4 flex-col justify-end gap-0.5 rounded-sm border border-accent-primary/25 bg-accent-primary/10 p-0.5"
            style={{ opacity }}
          >
            <span className="block h-1 w-full rounded-[1px] bg-accent-primary/75" />
            <span className="block h-0.5 w-full rounded-[1px] bg-accent-primary/45" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Mini diagram: dynamic prio vs Jito bribe bars. */
export function BlitzPrioBribePreview({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        PREVIEW_FRAME,
        'flex aspect-[5/3] w-full items-end justify-center gap-8 px-4 pb-4 pt-5',
        className,
      )}
      aria-hidden
    >
      <div className="flex flex-col items-center gap-1.5">
        <div className="flex h-14 w-10 items-end justify-center rounded-sm border border-accent-primary/30 bg-accent-primary/10 p-1">
          <div className="w-full rounded-[2px] bg-accent-primary/55" style={{ height: '46%' }} />
        </div>
        <span className="text-[9px] font-bold uppercase tracking-wide text-fg-muted">Prio</span>
      </div>
      <div className="flex flex-col items-center gap-1.5">
        <div className="flex h-14 w-10 items-end justify-center rounded-sm border border-accent-primary/30 bg-accent-primary/10 p-1">
          <div className="w-full rounded-[2px] bg-accent-primary" style={{ height: '78%' }} />
        </div>
        <span className="text-[9px] font-bold uppercase tracking-wide text-fg-muted">Bribe</span>
      </div>
    </div>
  );
}
