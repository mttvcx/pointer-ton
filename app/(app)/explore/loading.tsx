import { Skeleton } from '@/components/shared/Skeleton';

export default function ExploreLoading() {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden px-2 py-1 sm:px-2.5">
      <div className="flex shrink-0 items-center gap-2 border-b border-border-subtle pb-2">
        <Skeleton className="h-8 w-24 rounded-md" />
        <Skeleton className="h-8 w-32 rounded-md" />
        <Skeleton className="ml-auto h-8 w-20 rounded-md" />
      </div>
      <div className="relative mt-2 flex min-h-0 flex-1 animate-pulse overflow-hidden rounded-xl border border-border-subtle bg-bg-base">
        {Array.from({ length: 9 }).map((_, i) => {
          const jitter = (((i * 37) % 17) / 17) * 40;
          return (
            <div
              key={i}
              className="absolute rounded-full bg-gradient-to-br from-white/[0.07] via-white/[0.03] to-transparent opacity-65"
              style={{
                width: 48 + (i % 4) * 22,
                height: 48 + (i % 4) * 22,
                left: `${12 + i * 9 + jitter * 0.15}%`,
                top: `${18 + (i % 3) * 22}%`,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
