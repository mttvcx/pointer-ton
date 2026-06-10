import { Skeleton } from '@/components/shared/Skeleton';
import { OS } from '@/components/portfolio/walletOs';
import { cn } from '@/lib/utils/cn';

export function PortfolioBodySkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', OS.spotSurface, className)}>
      <div
        className={cn(
          'grid shrink-0 grid-cols-1 lg:grid-cols-3 lg:divide-x',
          OS.spotDivideX,
          OS.spotDivideY,
          'border-b',
          OS.spotHairline,
        )}
      >
        <Skeleton className="h-36 rounded-none bg-bg-hover/40" />
        <Skeleton className="h-36 rounded-none bg-bg-hover/40" />
        <Skeleton className="h-36 rounded-none bg-bg-hover/40" />
      </div>
      <div
        className={cn(
          'grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] xl:divide-x',
          OS.spotDivideX,
        )}
      >
        <div className="space-y-0 p-0">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-none border-b border-border-subtle/30 bg-bg-hover/25" />
          ))}
        </div>
        <Skeleton className="min-h-[240px] rounded-none bg-bg-hover/25" />
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
        'flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-bg-base',
        className,
      )}
    >
      <div className={cn('flex shrink-0 items-center gap-2 border-b px-4 py-2', OS.spotChromeHairline, OS.spotChrome)}>
        <Skeleton className="h-7 w-16 rounded-none bg-bg-hover/30" />
        <Skeleton className="h-7 w-20 rounded-none bg-bg-hover/30" />
        <Skeleton className="h-7 w-20 rounded-none bg-bg-hover/30" />
        <Skeleton className="ml-auto h-7 w-40 rounded-none bg-bg-hover/30" />
      </div>
      <PortfolioBodySkeleton />
    </div>
  );
}
