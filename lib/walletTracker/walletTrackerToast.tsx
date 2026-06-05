'use client';

import { toast } from 'sonner';
import {
  WalletTrackerTradeToast,
  type WalletTrackerTradeToastPayload,
} from '@/components/walletTracker/WalletTrackerTradeToast';
import { useWalletTrackerMuteStore } from '@/store/walletTrackerMute';

export const WALLET_TRACKER_TOASTER_ID = 'wallet-tracker';

const DEMO_TROLL_IMAGE = '/packs/troll.jpg';

const DEMO_WALLET = { label: 'west', key: 'west' };

/** First two pings in the stack stay readable; the 3rd+ dismisses in 0.5s (GMGN-style). */
export function durationForNextWalletTrackerToast(): number {
  const n = toast
    .getToasts()
    .filter((row) => (row as { toasterId?: string }).toasterId === WALLET_TRACKER_TOASTER_ID).length;
  return n >= 2 ? 500 : 5000;
}

type TradeSide = 'buy' | 'sell';

function demoPayload(side: TradeSide): WalletTrackerTradeToastPayload {
  if (side === 'buy') {
    return {
      walletLabel: DEMO_WALLET.label,
      walletKey: DEMO_WALLET.key,
      side: 'buy',
      actionLabel: 'bought',
      tokenSymbol: 'TROLL',
      tokenImageUrl: DEMO_TROLL_IMAGE,
      solAmount: '0.9043',
      mcLabel: '$12.4K',
      ageLabel: '4m',
      metaSuffix: 'demo ping',
    };
  }
  return {
    walletLabel: DEMO_WALLET.label,
    walletKey: DEMO_WALLET.key,
    side: 'sell',
    actionLabel: 'sold',
    tokenSymbol: 'TROLL',
    tokenImageUrl: DEMO_TROLL_IMAGE,
    solAmount: '0.421',
    mcLabel: '$18.9K',
    ageLabel: '17h',
    metaSuffix: 'demo ping',
  };
}

export function showWalletTrackerTradeToast(payload: WalletTrackerTradeToastPayload) {
  if (useWalletTrackerMuteStore.getState().isMuted(payload.walletKey)) return;

  toast.custom(
    (id) => <WalletTrackerTradeToast toastId={id} payload={payload} />,
    {
      toasterId: WALLET_TRACKER_TOASTER_ID,
      duration: durationForNextWalletTrackerToast(),
      className: 'wallet-tracker-trade-toast-host',
    },
  );
}

/** Routed to the dedicated top-center toaster (see `app/providers.tsx`). */
export function toastWalletTrackedTradeDemo(side: TradeSide = 'buy') {
  showWalletTrackerTradeToast(demoPayload(side));
}
