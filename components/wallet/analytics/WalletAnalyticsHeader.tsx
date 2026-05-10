'use client';

import { useState } from 'react';
import {
  ExternalLink,
  Search,
  Star,
  X,
} from 'lucide-react';
import { CopyButton } from '@/components/shared/CopyButton';
import { explorerUrlForAccount } from '@/lib/chains/explorerUrls';
import type { AppChainId } from '@/lib/chains/appChain';
import type { WalletAnalyticsTimeframe } from '@/lib/wallet-analytics/types';
import { shortenAddress } from '@/lib/utils/addresses';
import { cn } from '@/lib/utils/cn';
import { useUIStore } from '@/store/ui';

const TF: WalletAnalyticsTimeframe[] = ['1d', '7d', '30d', 'max'];

export function WalletAnalyticsHeader({
  address,
  chain,
  labelDraft,
  onLabelChange,
  timeframe,
  onTimeframe,
  onClose,
}: {
  address: string;
  chain: AppChainId;
  labelDraft: string;
  onLabelChange: (v: string) => void;
  timeframe: WalletAnalyticsTimeframe;
  onTimeframe: (tf: WalletAnalyticsTimeframe) => void;
  onClose: () => void;
}) {
  const [starOn, setStarOn] = useState(false);
  const setSearchOpen = useUIStore((s) => s.setSearchOpen);
  const explorer = explorerUrlForAccount(address);

  return (
    <div className="flex flex-col gap-3 border-b border-border-subtle/80 pb-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <input
            value={labelDraft}
            onChange={(e) => onLabelChange(e.target.value)}
            placeholder="Rename to track"
            className="w-full max-w-sm rounded-lg border border-border-subtle/80 bg-black/30 px-3 py-2 text-[13px] text-fg-primary placeholder:text-fg-muted focus:border-accent-primary/40 focus:outline-none"
          />
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[12px] text-fg-secondary">
              {shortenAddress(address, 5)}
            </span>
            <CopyButton
              value={address}
              toastLabel="Address copied"
              label="Copy wallet address"
              className="text-fg-muted hover:text-accent-primary"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-1">
          <button
            type="button"
            title={starOn ? 'Favorited' : 'Favorite'}
            onClick={() => setStarOn((v) => !v)}
            className={cn(
              'focus-ring rounded-lg p-2 transition hover:bg-bg-hover',
              starOn ? 'text-amber-300' : 'text-fg-muted',
            )}
          >
            <Star className={cn('h-4 w-4', starOn && 'fill-current')} strokeWidth={2} />
          </button>
          <a
            href={explorer}
            target="_blank"
            rel="noreferrer"
            title="Open externally"
            className="focus-ring rounded-lg p-2 text-fg-muted transition hover:bg-bg-hover hover:text-accent-primary"
          >
            <ExternalLink className="h-4 w-4" strokeWidth={2} />
          </a>
          <button
            type="button"
            title="Search"
            className="focus-ring rounded-lg p-2 text-fg-muted transition hover:bg-bg-hover hover:text-fg-primary"
            onClick={() => setSearchOpen(true)}
          >
            <Search className="h-4 w-4" strokeWidth={2} />
          </button>

          <div className="mx-1 hidden h-6 w-px bg-border-subtle sm:block" />

          <div className="flex items-center gap-1 rounded-lg border border-border-subtle/80 bg-black/25 p-0.5">
            {TF.map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => onTimeframe(tf)}
                className={cn(
                  'rounded-md px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide transition',
                  timeframe === tf
                    ? 'bg-accent-primary/20 text-accent-primary ring-1 ring-accent-primary/35'
                    : 'text-fg-muted hover:text-fg-secondary',
                )}
              >
                {tf === 'max' ? 'Max' : tf}
              </button>
            ))}
          </div>

          <button
            type="button"
            title="Close"
            onClick={onClose}
            className="focus-ring ml-1 rounded-lg p-2 text-fg-muted transition hover:bg-bg-hover hover:text-fg-primary"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      </div>

      <p className="text-[10px] text-fg-muted">
        Network: <span className="font-semibold text-fg-secondary">{chain.toUpperCase()}</span>
      </p>
    </div>
  );
}
