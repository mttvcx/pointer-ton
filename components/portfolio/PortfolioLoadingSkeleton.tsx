import { Skeleton } from '@/components/shared/Skeleton';
import { cn } from '@/lib/utils/cn';

export function PortfolioLoadingSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-bg-base px-1 py-1.5 sm:px-2',
        className,
      )}
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-border-subtle pb-3">
        <Skeleton className="h-9 w-20 rounded-md" />
        <Skeleton className="h-9 w-24 rounded-md" />
        <Skeleton className="h-9 w-24 rounded-md" />
        <Skeleton className="ml-auto h-9 w-32 rounded-md" />
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
      </div>
      <div className="mt-4 min-h-0 flex-1 space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-md" />
        ))}
      </div>
    </div>
  );
}
