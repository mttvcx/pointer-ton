import { Skeleton } from '@/components/shared/Skeleton';

/** Token desk shell while server fetches mint row + snapshot (no blocking hydrate). */
export default function TokenPageLoading() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-bg-raised">
      <div className="border-b border-white/[0.06] px-3 py-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="ml-4 h-8 w-20" />
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-6 w-16" />
        </div>
      </div>
      <Skeleton className="m-2 min-h-[280px] rounded-lg" />
      <Skeleton className="mx-2 mb-2 min-h-[240px] flex-1 rounded-lg" />
    </div>
  );
}
