'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/shared/Skeleton';

/**
 * Client-side lazy wrapper so the heavy Packs terminal chunk loads after the
 * route shell paints. UI/placement is unchanged; a full-area skeleton holds the
 * layout while the chunk hydrates.
 */
const PacksTerminalDynamic = dynamic(
  () => import('@/components/packs/PacksTerminal').then((m) => ({ default: m.PacksTerminal })),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-0 flex-1 flex-col">
        <Skeleton className="h-full min-h-[60vh] w-full rounded-lg" />
      </div>
    ),
  },
);

export function PacksTerminalLazy({ className }: { className?: string }) {
  return <PacksTerminalDynamic className={className} />;
}
