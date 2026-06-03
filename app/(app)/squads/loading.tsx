import { Skeleton } from '@/components/shared/Skeleton';

export default function SquadsLoading() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 bg-bg-base p-2 sm:p-3">
      <Skeleton className="h-10 w-full max-w-xl rounded-md" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-36 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
