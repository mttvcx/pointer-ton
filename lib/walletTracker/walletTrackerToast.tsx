'use client';

import { toast } from 'sonner';
import { ChainIcon } from '@/components/squads/ChainIcon';

export const WALLET_TRACKER_TOASTER_ID = 'wallet-tracker';

/** First two pings in the stack stay readable; the 3rd+ dismisses in 0.5s (GMGN-style). */
export function durationForNextWalletTrackerToast(): number {
  const n = toast
    .getToasts()
    .filter((row) => (row as { toasterId?: string }).toasterId === WALLET_TRACKER_TOASTER_ID).length;
  return n >= 2 ? 500 : 5000;
}

type TradeSide = 'buy' | 'sell';

function TrackerAmountLine({ sol, rest }: { sol: string; rest: string }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1 gap-y-0.5">
      <span className="tabular-nums">{sol}</span>
      <ChainIcon chain="solana" size={13} className="translate-y-[0.5px]" />
      <span className="text-fg-secondary">{rest}</span>
    </span>
  );
}

/** Routed to the dedicated top-center toaster (see `app/providers.tsx`). */
export function toastWalletTrackedTradeDemo(side: TradeSide = 'buy') {
  const isBuy = side === 'buy';
  toast.message(isBuy ? 'west bought DEMO' : 'west sold DEMO', {
    toasterId: WALLET_TRACKER_TOASTER_ID,
    description: (
      <>
        {isBuy ? (
          <TrackerAmountLine sol="0.9043" rest="at $12.4K MC · demo ping" />
        ) : (
          <TrackerAmountLine sol="0.421" rest="at $18.9K MC · demo ping" />
        )}
      </>
    ),
    duration: durationForNextWalletTrackerToast(),
    classNames: {
      toast:
        '!bg-bg-base !border border-border-subtle shadow-lg animate-in fade-in zoom-in-95 slide-in-from-top duration-150',
      title: 'text-sm font-semibold text-fg-primary',
      description: 'text-xs text-fg-secondary [&_img]:rounded-sm',
    },
    icon: (
      <span
        className={
          isBuy
            ? 'flex h-7 w-7 items-center justify-center rounded-full bg-signal-bull/15 text-[10px] font-bold text-signal-bull'
            : 'flex h-7 w-7 items-center justify-center rounded-full bg-signal-bear/15 text-[10px] font-bold text-signal-bear'
        }
        aria-hidden
      >
        {isBuy ? '▲' : '▼'}
      </span>
    ),
  });
}
