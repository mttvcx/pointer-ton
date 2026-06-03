import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PointsDashboard } from '@/components/points/PointsDashboard';

export const metadata: Metadata = {
  title: '$PTR Points',
  description: 'Season 1 $PTR Points — accrual from trading, referrals, and verified Pointer usage',
};

function PointsFallback() {
  return (
    <div className="flex min-h-[calc(100dvh-var(--app-topbar-h)-var(--app-bottombar-h))] min-h-0 flex-col items-center justify-center bg-bg-base px-1 py-1 text-[12px] text-fg-muted sm:px-1.5">
      Loading…
    </div>
  );
}

export default function PointsPage() {
  return (
    <div className="flex min-h-[calc(100dvh-var(--app-topbar-h)-var(--app-bottombar-h))] min-h-0 flex-col bg-bg-base px-1 py-1 sm:px-1.5">
      <Suspense fallback={<PointsFallback />}>
        <PointsDashboard className="min-h-0 flex-1" />
      </Suspense>
    </div>
  );
}
