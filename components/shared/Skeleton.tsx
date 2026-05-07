import { cn } from '@/lib/utils/cn';

/**
 * Shimmer-block placeholder. Composes the `.skeleton` class declared in
 * `globals.css`. Always render with explicit width/height so the layout
 * doesn't jump when real content lands.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn('skeleton block h-3 w-full rounded-sm', className)}
    />
  );
}

/** Pre-styled token-row skeleton matching the Pulse layout. */
export function PulseRowSkeleton() {
  return (
    <div className="flex min-h-[84px] items-center gap-3 border-b border-border-subtle px-3 py-2.5">
      <Skeleton className="h-[52px] w-[52px] shrink-0 rounded-md" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="ml-auto h-3 w-12" />
        </div>
        <div className="flex gap-3 pt-0.5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-14" />
        </div>
      </div>
    </div>
  );
}

/** Pre-styled stat row skeleton for the horizontal stat strip. */
export function StatStripSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="flex flex-wrap divide-x divide-border-subtle overflow-hidden border-b border-border-subtle">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex-1 space-y-1 px-3 py-2">
          <Skeleton className="h-2 w-12" />
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}

export function TableRowSkeleton({ cols = 5 }: { cols?: number }) {
  return (
    <tr className="border-b border-border-subtle/60">
      {Array.from({ length: cols }, (_, i) => (
        <td key={i} className="py-2 pr-3">
          <Skeleton className="h-3 w-16" />
        </td>
      ))}
    </tr>
  );
}
