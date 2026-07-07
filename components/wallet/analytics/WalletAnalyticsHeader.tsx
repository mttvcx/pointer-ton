'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { CopyButton } from '@/components/shared/CopyButton';
import { explorerUrlForAccount } from '@/lib/chains/explorerUrls';
import type { AppChainId } from '@/lib/chains/appChain';
import { CHAIN_ICON_PNG, CHAIN_TICKER } from '@/lib/chains/chainAssets';
import type { WalletAnalyticsTimeframe } from '@/lib/wallet-analytics/types';
import { useWalletLabels, labelColorClass } from '@/lib/hooks/useWalletLabels';
import { AppleEmoji } from '@/components/ui/AppleEmoji';
import { cn } from '@/lib/utils/cn';
import { Search, RefreshCw, Pencil, X, Loader2 } from 'lucide-react';
import { useUIStore } from '@/store/ui';

const TF: WalletAnalyticsTimeframe[] = ['1d', '7d', '30d', 'max'];

function formatHeaderAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

const controlBtn =
  'focus-ring inline-flex h-8 w-8 items-center justify-center rounded-lg text-fg-muted transition hover:bg-bg-hover hover:text-fg-primary';

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

  const { resolveLabel, saveLabel } = useWalletLabels();
  const resolved = resolveLabel(address);
  const tracked = resolved?.labeled ? resolved : null;
  const [saving, setSaving] = useState(false);

  // Enter in the name field → track the wallet immediately (name + yellow), no
  // navigation away. Empty name is a no-op.
  async function trackNow() {
    const name = labelDraft.trim();
    if (!name || saving) return;
    setSaving(true);
    try {
      await saveLabel(address, { label: name, color: tracked?.color ?? 'yellow', emoji: tracked?.emoji ?? null });
      toast.success('Wallet tracked');
    } catch {
      toast.error('Couldn’t track wallet — try again');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="shrink-0 border-b border-border-subtle px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium uppercase tracking-widest text-fg-muted">Track wallet</p>
          <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-2">
            {tracked ? (
              <span
                className={cn('inline-flex items-center gap-1 font-sans text-sm font-semibold', labelColorClass(tracked.color))}
                title={address}
              >
                {tracked.emoji ? <AppleEmoji emoji={tracked.emoji} size={14} /> : null}
                {tracked.label}
                <span className="ml-1 rounded bg-white/5 px-1 py-0.5 text-[9px] font-medium uppercase tracking-wider text-fg-muted">
                  tracked
                </span>
              </span>
            ) : (
              <span
                className="font-sans text-sm font-medium tabular-nums text-fg-primary"
                title={address}
              >
                {formatHeaderAddress(address)}
              </span>
            )}
            <CopyButton
              value={address}
              toastLabel="Address copied"
              label="Copy wallet address"
              className="shrink-0 text-fg-muted hover:text-fg-primary"
            />
            <button
              type="button"
              className="ml-1.5 inline-flex shrink-0 cursor-pointer items-center justify-center rounded-lg text-fg-muted transition-colors hover:text-fg-primary"
              title="Rename / label"
              onClick={() => {
                renameRef.current?.focus();
                renameRef.current?.select?.();
              }}
            >
              <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          </div>
          <div className="relative mt-2 w-full max-w-md">
            <input
              ref={renameRef}
              value={labelDraft}
              onChange={(e) => onLabelChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void trackNow();
                }
              }}
              placeholder={tracked ? 'Rename — Enter to save' : 'Name it & press Enter to track'}
              className="h-8 w-full rounded-md border border-border-subtle bg-transparent px-2.5 pr-8 text-xs text-fg-primary outline-none transition placeholder:text-fg-muted focus:border-accent-primary/50 focus:outline-none"
            />
            {saving ? (
              <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-fg-muted" />
            ) : null}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Link
              href={`/wallets?wallet=${encodeURIComponent(address)}`}
              prefetch={false}
              className="text-xs text-accent-primary transition-colors hover:text-accent-glow"
            >
              Track in list
            </Link>
            <span className="text-fg-muted/50">·</span>
            <a
              href={explorer}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-accent-primary transition-colors hover:text-accent-glow"
            >
              Explorer
            </a>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <span className="mr-1 inline-flex items-center gap-1 rounded-md border border-border-subtle px-1.5 py-0.5 text-[9px] font-semibold text-fg-muted">
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

          <div className="flex h-8 items-center gap-0.5 rounded-lg border border-border-subtle p-0.5">
            {TF.map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => onTimeframe(tf)}
                className={cn(
                  'border-b-2 px-2 py-1 text-xs transition-colors',
                  timeframe === tf
                    ? 'border-accent-primary font-semibold text-fg-primary'
                    : 'border-transparent text-fg-muted hover:text-fg-secondary',
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
            className="focus-ring ml-0.5 inline-flex h-7 w-7 items-center justify-center rounded text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-primary"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );
}
