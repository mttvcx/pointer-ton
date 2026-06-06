'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/shared/Skeleton';

/**
 * Client-side lazy wrapper so the Explore panel chunk loads after the route
 * shell paints. UI/placement is unchanged.
 */
const ExploreTokensPanelDynamic = dynamic(
  () =>
    import('@/components/explore/ExploreTokensPanel').then((m) => ({
      default: m.ExploreTokensPanel,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-0 flex-1 flex-col">
        <Skeleton className="h-full min-h-[60vh] w-full rounded-lg" />
      </div>
    ),
  },
);

export function ExploreTokensPanelLazy() {
  return <ExploreTokensPanelDynamic />;
}
