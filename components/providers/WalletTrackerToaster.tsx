'use client';

import { Toaster } from 'sonner';
import { WALLET_TRACKER_TOASTER_ID } from '@/lib/walletTracker/walletTrackerToast';
import { toastOffset, useToastAnchorRight } from '@/lib/ui/toastLayout';
import { cn } from '@/lib/utils/cn';
import { useShellPrefsStore } from '@/store/shellPrefs';

/**
 * Wallet / trade “ping” channel. When the hover briefing / answer strip is open,
 * anchor under the top-right so it clears the centered pill + expanded answer box.
 */
export function WalletTrackerToaster() {
  const anchorRight = useToastAnchorRight();
  const toastPosition = useShellPrefsStore((s) => s.toastPosition);
  const placement = anchorRight ? 'top-right' : toastPosition;

  return (
    <Toaster
      id={WALLET_TRACKER_TOASTER_ID}
      theme="dark"
      position={placement}
      className={cn('toaster-wallet-tracker', anchorRight && 'toaster-wallet-tracker--answer-open')}
      richColors={false}
      gap={12}
      expand
      visibleToasts={3}
      swipeDirections={['bottom']}
      offset={toastOffset(placement)}
      toastOptions={{
        duration: 5000,
        classNames: {
          toast: '!bg-transparent !border-0 !p-0 !shadow-none',
        },
      }}
    />
  );
}
