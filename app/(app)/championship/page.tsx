import type { Metadata } from 'next';
import { ChampionshipTerminalLazy } from '@/components/championship/ChampionshipTerminalLazy';

export const metadata: Metadata = {
  title: 'Championship',
  description: 'Pointer Trading Championship Series — weekly cups, squads, and World Cup qualification',
};

export default function ChampionshipPage() {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-bg-base px-1 py-1 sm:px-1.5">
      <ChampionshipTerminalLazy />
    </div>
  );
}
