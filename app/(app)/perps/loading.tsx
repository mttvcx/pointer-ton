import { Skeleton } from '@/components/shared/Skeleton';

export default function PerpsLoading() {
  return (
    <div className="flex min-h-full flex-col bg-bg-base">
      <div className="border-b border-border-subtle px-2 py-2">
        <Skeleton className="h-8 w-64 rounded-md" />
      </div>
      <div className="grid flex-1 grid-cols-1 gap-px bg-border-subtle xl:grid-cols-[1fr_11rem_17.5rem]">
        <Skeleton className="min-h-[280px] rounded-none" />
        <Skeleton className="min-h-[200px] rounded-none" />
        <Skeleton className="min-h-[320px] rounded-none" />
      </div>
    </div>
  );
}
