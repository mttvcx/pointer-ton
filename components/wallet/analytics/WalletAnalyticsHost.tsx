'use client';

import { PnlShareComposer } from '@/components/wallet/analytics/PnlShareComposer';
import { WalletAnalyticsModal } from '@/components/wallet/analytics/WalletAnalyticsModal';

/** Mounted once under the app shell — hosts wallet intel + PNL composer overlays. */
export function WalletAnalyticsHost() {
  return (
    <>
      <WalletAnalyticsModal />
      <PnlShareComposer />
    </>
  );
}
