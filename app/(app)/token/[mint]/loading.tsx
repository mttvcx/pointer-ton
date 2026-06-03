import { Skeleton } from '@/components/shared/Skeleton';

export default function TokenDetailLoading() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden bg-bg-base p-2 sm:p-3">
      <div className="flex shrink-0 items-center gap-3">
        <Skeleton className="h-12 w-12 rounded-md" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Skeleton className="h-5 w-40 rounded" />
          <Skeleton className="h-4 w-64 rounded" />
        </div>
        <Skeleton className="hidden h-9 w-24 rounded-md sm:block" />
      </div>
      <Skeleton className="min-h-[280px] flex-1 rounded-lg" />
      <div className="grid shrink-0 gap-3 md:grid-cols-2">
        <Skeleton className="h-48 rounded-lg" />
        <Skeleton className="h-48 rounded-lg" />
      </div>
    </div>
  );
}
