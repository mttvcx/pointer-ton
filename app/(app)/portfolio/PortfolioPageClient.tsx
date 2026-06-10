'use client';

import dynamic from 'next/dynamic';
import { PortfolioBodySkeleton } from '@/components/portfolio/PortfolioLoadingSkeleton';

const PortfolioDashboard = dynamic(
  () =>
    import('@/components/portfolio/PortfolioDashboard').then((m) => ({
      default: m.PortfolioDashboard,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
        <PortfolioBodySkeleton />
      </div>
    ),
  },
);

type PortfolioTabParam = 'spot' | 'wallets' | 'trackers';

export function PortfolioPageClient({
  initialTab,
  prefillTrackerWallet,
}: {
  initialTab?: PortfolioTabParam;
  prefillTrackerWallet?: string;
}) {
  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-bg-base">
      <PortfolioDashboard
        className="min-h-0 flex-1"
        initialTab={initialTab}
        prefillTrackerWallet={prefillTrackerWallet}
      />
    </div>
  );
}
