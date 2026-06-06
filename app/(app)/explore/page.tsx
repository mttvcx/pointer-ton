import type { Metadata } from 'next';
import { ExploreTokensPanelLazy } from '@/components/explore/ExploreTokensPanelLazy';

export const metadata: Metadata = {
  description: 'New-launch bubble pool by default — switch to Hot for trending tape or Axiom desk view.',
};

export default function ExplorePage() {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden px-2 py-1 sm:px-2.5">
      <ExploreTokensPanelLazy />
    </div>
  );
}
