import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ReferralDashboard } from '@/components/referral/ReferralDashboard';

export const metadata: Metadata = {
  title: 'Referral',
  description: 'Pointer referral program',
};

export default function ReferralPage() {
  return (
    <div className="flex min-h-[calc(100dvh-var(--app-topbar-h)-var(--app-bottombar-h))] min-h-0 flex-col px-3 py-3 sm:px-4">
      <header className="shrink-0 border-b border-border-subtle pb-3">
        <h1 className="text-base font-semibold tracking-tight text-fg-primary">Referrals</h1>
        <p className="mt-0.5 text-[11px] text-fg-secondary">
          Share your code. Earn a flat share of platform fees when your referees trade.
        </p>
      </header>
      <Suspense
        fallback={
          <div className="flex flex-1 items-center justify-center text-fg-muted">Loading...</div>
        }
      >
        <ReferralDashboard className="min-h-0 flex-1 overflow-y-auto pt-4" />
      </Suspense>
    </div>
  );
}
