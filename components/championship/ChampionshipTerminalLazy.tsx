'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/shared/Skeleton';

/**
 * Client-side lazy wrapper so the Championship terminal chunk loads after the
 * route shell paints. UI/placement is unchanged.
 */
const ChampionshipTerminalDynamic = dynamic(
  () =>
    import('@/components/championship/ChampionshipTerminal').then((m) => ({
      default: m.ChampionshipTerminal,
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

export function ChampionshipTerminalLazy() {
  return <ChampionshipTerminalDynamic />;
}
