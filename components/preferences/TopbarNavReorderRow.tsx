'use client';

import { useMemo, useState } from 'react';
import { GripVertical, RotateCcw } from 'lucide-react';
import { APP_NAV } from '@/components/layout/navConfig';
import { normalizeTopbarNavOrder, type TopbarNavId } from '@/lib/layout/topbarNav';
import { useTopbarNavStore } from '@/store/topbarNav';
import { cn } from '@/lib/utils/cn';

const LABEL_BY_HREF = new Map(APP_NAV.map((item) => [item.href, item.label]));

type TopbarNavReorderRowProps = {
  className?: string;
  /** Compact copy for the top-bar tear-off popover. */
  variant?: 'popover' | 'modal';
};

export function TopbarNavReorderRow({ className, variant = 'popover' }: TopbarNavReorderRowProps) {
  const orderRaw = useTopbarNavStore((s) => s.order);
  const order = useMemo(() => normalizeTopbarNavOrder(orderRaw), [orderRaw]);
  const moveItem = useTopbarNavStore((s) => s.moveItem);
  const resetOrder = useTopbarNavStore((s) => s.resetOrder);
  const [dragIx, setDragIx] = useState<number | null>(null);
  const [overIx, setOverIx] = useState<number | null>(null);

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-start justify-between gap-2">
        <p
          className={cn(
            'min-w-0 leading-snug text-fg-primary/92',
            variant === 'popover' ? 'text-[10px] font-medium' : 'text-[11px]',
          )}
        >
          Drag to reorder top bar links — left to right matches the nav beside the logo.
        </p>
        <button
          type="button"
          title="Reset nav order"
          onClick={() => resetOrder()}
          className="shrink-0 rounded-md p-1 text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-primary"
        >
          <RotateCcw className="h-3 w-3" aria-hidden />
        </button>
      </div>

      <div className="flex flex-wrap items-start justify-center gap-1.5 rounded-lg border border-border-subtle bg-bg-sunken/40 p-1.5">
        {order.map((href, ix) => {
          const label = LABEL_BY_HREF.get(href as TopbarNavId) ?? href;
          return (
            <div
              key={href}
              draggable
              onDragStart={() => setDragIx(ix)}
              onDragOver={(ev) => {
                ev.preventDefault();
                if (dragIx !== null && dragIx !== ix) setOverIx(ix);
              }}
              onDrop={() => {
                if (dragIx === null || dragIx === ix) {
                  setOverIx(null);
                  return;
                }
                moveItem(dragIx, ix);
                setDragIx(null);
                setOverIx(null);
              }}
              onDragEnd={() => {
                setDragIx(null);
                setOverIx(null);
              }}
              className={cn(
                'relative flex cursor-grab active:cursor-grabbing flex-col items-center gap-0.5 rounded-md border border-transparent px-2 py-1.5 transition-colors select-none hover:bg-bg-hover/90 active:brightness-110',
                dragIx === ix && 'opacity-60',
              )}
            >
              {dragIx !== null && dragIx !== ix && overIx === ix ? (
                <span
                  aria-hidden
                  className="pointer-events-none absolute -left-[5px] top-1 bottom-1 w-[3px] rounded-full bg-accent-primary shadow-[0_0_6px_rgba(124,92,255,0.6)]"
                />
              ) : null}
              <GripVertical
                className="absolute bottom-1 left-0.5 h-2.5 w-2.5 text-fg-muted/60"
                aria-hidden
              />
              <span className="flex h-[18px] min-w-[2.25rem] items-center justify-center rounded-md border border-border-subtle/80 bg-bg-base/80 px-1.5 text-[9px] font-bold uppercase tracking-wide text-fg-primary">
                {label.length > 8 ? `${label.slice(0, 7)}…` : label}
              </span>
              <span className="max-w-[4.5rem] truncate text-center text-[10px] font-medium leading-tight text-fg-primary/92">
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
