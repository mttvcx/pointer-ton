import type { Metadata } from 'next';
import { ExploreTokensPanel } from '@/components/explore/ExploreTokensPanel';

export const metadata: Metadata = {
  title: 'Explore',
  description: 'Top tokens by chain',
};

export default function ExplorePage() {
  return (
    <div className="flex min-h-[calc(100dvh-var(--app-topbar-h)-var(--app-bottombar-h))] min-h-0 flex-col px-3 py-3">
      <ExploreTokensPanel />
    </div>
  );
}
