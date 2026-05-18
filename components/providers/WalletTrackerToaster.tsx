'use client';

import { Toaster } from 'sonner';
import { WALLET_TRACKER_TOASTER_ID } from '@/lib/walletTracker/walletTrackerToast';
import { useUIStore } from '@/store/ui';
import { cn } from '@/lib/utils/cn';

/**
 * Wallet / trade “ping” channel. When the hover briefing / answer strip is open,
 * anchor under the top-right so it clears the centered pill + expanded answer box.
 */
export function WalletTrackerToaster() {
  const anchorRight = useUIStore(
    (s) =>
      s.copilotTopStripActive || (s.copilotDisplayMode === 'pill' && s.copilotPillExpanded),
  );

  return (
    <Toaster
      id={WALLET_TRACKER_TOASTER_ID}
      theme="dark"
      position={anchorRight ? 'top-right' : 'top-center'}
      className={cn('toaster-wallet-tracker', anchorRight && 'toaster-wallet-tracker--answer-open')}
      richColors={false}
      gap={12}
      expand
      visibleToasts={3}
      swipeDirections={['bottom']}
      offset={
        anchorRight
          ? { top: 'calc(var(--app-topbar-h) + 12px)', right: '14px' }
          : { top: 'calc(var(--app-topbar-h) + 12px)' }
      }
      toastOptions={{
        duration: 5000,
        classNames: {
          toast: '!bg-bg-base',
        },
      }}
    />
  );
}
