'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { CopyButton } from '@/components/shared/CopyButton';
import { explorerUrlForAccount } from '@/lib/chains/explorerUrls';
import type { AppChainId } from '@/lib/chains/appChain';
import { CHAIN_ICON_PNG, CHAIN_TICKER } from '@/lib/chains/chainAssets';
import type { WalletAnalyticsTimeframe } from '@/lib/wallet-analytics/types';
import { cn } from '@/lib/utils/cn';
import { Search, RefreshCw, Pencil, X } from 'lucide-react';
import { useUIStore } from '@/store/ui';

const TF: WalletAnalyticsTimeframe[] = ['1d', '7d', '30d', 'max'];

const controlBtn =
  'focus-ring inline-flex h-8 w-8 items-center justify-center rounded-lg text-fg-muted transition hover:bg-white/[0.045] hover:text-fg-primary';

export function WalletAnalyticsHeader({
  address,
  chain,
  labelDraft,
  onLabelChange,
  timeframe,
  onTimeframe,
  onClose,
  onRefresh,
}: {
  address: string;
  chain: AppChainId;
  labelDraft: string;
  onLabelChange: (v: string) => void;
  timeframe: WalletAnalyticsTimeframe;
  onTimeframe: (tf: WalletAnalyticsTimeframe) => void;
  onClose: () => void;
  onRefresh?: () => void;
}) {
  const renameRef = useRef<HTMLInputElement>(null);
  const setSearchOpen = useUIStore((s) => s.setSearchOpen);
  const explorer = explorerUrlForAccount(address);
  const chainTicker = CHAIN_TICKER[chain];

  return (
    <div className="border-b border-white/[0.06] bg-[#070910]/98 px-3 py-3 sm:px-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-fg-muted">Track wallet</p>
          <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-2">
            <span className="break-all font-mono text-[12px] font-medium leading-snug text-fg-primary" title={address}>
              {address}
            </span>
            <CopyButton
              value={address}
              toastLabel="Address copied"
              label="Copy wallet address"
              className="shrink-0 text-fg-muted hover:text-fg-primary"
            />
            <button
              type="button"
              className={cn(controlBtn, 'h-7 w-7')}
              title="Rename / label"
              onClick={() => {
                renameRef.current?.focus();
                renameRef.current?.select?.();
              }}
            >
              <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          </div>
          <input
            ref={renameRef}
            value={labelDraft}
            onChange={(e) => onLabelChange(e.target.value)}
            placeholder="Private label (optional)"
            className="mt-2 h-8 w-full max-w-md rounded-md border border-white/[0.08] bg-black/30 px-2.5 text-[11px] text-fg-primary outline-none transition placeholder:text-fg-muted/70 focus:border-accent-primary/35"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Link
              href={`/wallets?wallet=${encodeURIComponent(address)}`}
              prefetch={false}
              className="text-[10px] font-semibold text-accent-primary hover:underline"
            >
              Track in list
            </Link>
            <span className="text-fg-muted/50">·</span>
            <a
              href={explorer}
              target="_blank"
              rel="noreferrer"
              className="text-[10px] font-medium text-fg-muted hover:text-fg-secondary"
            >
              Explorer
            </a>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <span className="mr-1 inline-flex items-center gap-1 rounded-md border border-white/[0.07] bg-black/25 px-1.5 py-0.5 text-[9px] font-semibold text-fg-muted">
            <img src={CHAIN_ICON_PNG[chain]} alt="" width={14} height={14} className="h-3.5 w-3.5 object-contain" draggable={false} />
            {chainTicker}
          </span>

          {onRefresh ? (
            <button type="button" className={controlBtn} title="Refresh" onClick={() => onRefresh()}>
              <RefreshCw className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          ) : null}

          <button type="button" className={controlBtn} title="Search" onClick={() => setSearchOpen(true)}>
            <Search className="h-3.5 w-3.5" strokeWidth={2} />
          </button>

          <div className="mx-0.5 hidden h-5 w-px bg-white/[0.08] sm:block" />

          <div className="flex h-8 items-center gap-0.5 rounded-lg border border-white/[0.08] bg-black/25 p-0.5">
            {TF.map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => onTimeframe(tf)}
                className={cn(
                  'rounded-md px-2.5 py-1 text-[10px] font-semibold tabular-nums transition',
                  timeframe === tf
                    ? 'bg-emerald-500/20 text-emerald-200 shadow-[inset_0_0_0_1px_rgba(52,211,153,0.25)]'
                    : 'text-fg-muted hover:bg-white/[0.04] hover:text-fg-secondary',
                )}
              >
                {tf === 'max' ? 'Max' : tf}
              </button>
            ))}
          </div>

          <button type="button" title="Close" onClick={onClose} className={cn(controlBtn, 'ml-0.5')}>
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );
}
