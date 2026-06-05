'use client';

import { Bell, BellOff, X } from 'lucide-react';
import { toast } from 'sonner';
import { ChainIcon } from '@/components/squads/ChainIcon';
import { cn } from '@/lib/utils/cn';
import { useWalletTrackerMuteStore } from '@/store/walletTrackerMute';

export type WalletTrackerTradeToastPayload = {
  walletLabel: string;
  walletKey: string;
  side: 'buy' | 'sell';
  /** e.g. "bought" | "bought more" | "sold" */
  actionLabel: string;
  tokenSymbol: string;
  tokenImageUrl: string;
  solAmount: string;
  mcLabel: string;
  /** Age chip on avatar — "4m", "17h", … */
  ageLabel: string;
  metaSuffix?: string;
};

export function WalletTrackerTradeToast({
  toastId,
  payload,
}: {
  toastId: string | number;
  payload: WalletTrackerTradeToastPayload;
}) {
  const muted = useWalletTrackerMuteStore((s) => s.isMuted(payload.walletKey));
  const toggleMuted = useWalletTrackerMuteStore((s) => s.toggleMuted);
  const isBuy = payload.side === 'buy';

  return (
    <div
      className={cn(
        'pointer-events-auto w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-lg border',
        'border-white/[0.09] bg-bg-raised/95 shadow-[0_18px_48px_-16px_rgba(0,0,0,0.85)]',
        'backdrop-blur-md',
        'motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-[0.98] motion-safe:slide-in-from-top-1 motion-safe:duration-150',
      )}
      role="status"
    >
      <div className="flex items-start gap-2.5 p-2.5">
        <div className="relative h-10 w-10 shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={payload.tokenImageUrl}
            alt=""
            width={40}
            height={40}
            className="h-10 w-10 rounded-md border border-white/[0.08] object-cover"
          />
          <span
            className={cn(
              'absolute -bottom-1 left-0 rounded border px-1 py-px font-mono text-[9px] font-semibold leading-none tabular-nums',
              isBuy
                ? 'border-signal-bull/40 bg-bg-base/95 text-signal-bull'
                : 'border-signal-bear/40 bg-bg-base/95 text-signal-bear',
            )}
          >
            {payload.ageLabel}
          </span>
          <span
            className="absolute -bottom-1 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border border-signal-bull/35 bg-bg-base/95"
            aria-hidden
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/pumpfun.webp" alt="" width={10} height={10} className="h-2.5 w-2.5 object-contain" />
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-1">
            <p className="min-w-0 flex-1 text-[12px] font-medium leading-[1.35] tracking-tight">
              <span className="font-semibold text-fg-primary">{payload.walletLabel}</span>
              <span className={cn('font-medium', isBuy ? 'text-signal-bull' : 'text-signal-bear')}>
                {' '}
                {payload.actionLabel}{' '}
              </span>
              <span className="font-semibold text-fg-primary">{payload.tokenSymbol}</span>
            </p>

            <button
              type="button"
              onClick={() => toggleMuted(payload.walletKey)}
              className={cn(
                'btn-press -mr-0.5 shrink-0 rounded-md p-1 transition-colors',
                muted
                  ? 'text-fg-muted hover:bg-white/[0.06] hover:text-fg-secondary'
                  : 'text-rose-400 hover:bg-rose-500/10 hover:text-rose-300',
              )}
              title={muted ? 'Unmute wallet pings' : 'Mute wallet pings'}
              aria-label={muted ? 'Unmute wallet pings' : 'Mute wallet pings'}
              aria-pressed={!muted}
            >
              {muted ? (
                <BellOff className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
              ) : (
                <Bell className="h-3.5 w-3.5 fill-current" strokeWidth={2} aria-hidden />
              )}
            </button>

            <button
              type="button"
              onClick={() => toast.dismiss(toastId)}
              className="btn-press shrink-0 rounded-md p-1 text-fg-muted transition-colors hover:bg-white/[0.06] hover:text-fg-secondary"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
            </button>
          </div>

          <p className="mt-0.5 flex flex-wrap items-center gap-x-1 gap-y-0 text-[11px] leading-snug">
            <ChainIcon chain="solana" size={12} className="shrink-0 translate-y-[0.5px]" />
            <span
              className={cn(
                'font-semibold tabular-nums',
                isBuy ? 'text-signal-bull' : 'text-signal-bear',
              )}
            >
              {payload.solAmount}
            </span>
            <span className="text-fg-secondary">
              at {payload.mcLabel} MC
              {payload.metaSuffix ? ` · ${payload.metaSuffix}` : null}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
