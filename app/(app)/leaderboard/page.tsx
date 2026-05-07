import type { Metadata } from 'next';
import { PointsDashboard } from '@/components/points/PointsDashboard';

export const metadata: Metadata = {
  title: 'Leaderboard',
  description: 'Pointer points leaderboard',
};

export default function LeaderboardPage() {
  return (
    <div className="flex min-h-[calc(100dvh-var(--app-topbar-h)-var(--app-bottombar-h))] min-h-0 flex-col bg-[#0b0d12] px-1 py-1 sm:px-1.5">
      <PointsDashboard className="min-h-0 flex-1" initialTab="leaderboard" />
    </div>
  );
}
