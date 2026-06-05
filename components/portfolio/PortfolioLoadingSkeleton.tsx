import { Skeleton } from '@/components/shared/Skeleton';
import { cn } from '@/lib/utils/cn';

export function PortfolioBodySkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col gap-4 p-2 sm:p-3', className)}>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Skeleton className="h-36 rounded-lg" />
        <Skeleton className="h-36 rounded-lg" />
        <Skeleton className="h-36 rounded-lg" />
      </div>
      <div className="min-h-0 flex-1 space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-md" />
        ))}
      </div>
    </div>
  );
}

export function PortfolioLoadingSkeleton({
  className,
  variant = 'page',
}: {
  className?: string;
  variant?: 'page' | 'body';
}) {
  if (variant === 'body') {
    return (
      <div
        className={cn(
          'flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-bg-base',
          className,
        )}
      >
        <PortfolioBodySkeleton />
      </div>
    );
  }

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
      <PortfolioBodySkeleton className="mt-3 px-0 sm:px-0" />
    </div>
  );
}
