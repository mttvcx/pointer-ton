import { Skeleton } from '@/components/shared/Skeleton';

export default function PointsLoading() {
  return (
    <div className="flex min-h-[calc(100dvh-var(--app-topbar-h)-var(--app-bottombar-h))] min-h-0 flex-col bg-bg-base px-1 py-1 sm:px-1.5">
      <div className="grid gap-3 md:grid-cols-3">
        <Skeleton className="h-28 rounded-lg" />
        <Skeleton className="h-28 rounded-lg md:col-span-2" />
      </div>
      <div className="mt-4 min-h-0 flex-1 space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-md" />
        ))}
      </div>
    </div>
  );
}
