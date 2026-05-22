'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { toastCopied, toastCopyFailed } from '@/lib/ui/copyToast';
import { usePulseQuickBuy } from '@/lib/hooks/usePulseQuickBuy';
import { BUY_PRESETS_SOL } from '@/lib/utils/constants';
import type { ExploreSortMode, ExploreTimeWindow, TokenExploreItem } from '@/types/explore';
import { formatCompactUsd } from '@/lib/utils/formatters';
import { shortenAddress } from '@/lib/utils/addresses';
import { cn } from '@/lib/utils/cn';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { usePulseColumnStore } from '@/store/pulseColumns';

type Props = {
  items: TokenExploreItem[];
  sortMode: ExploreSortMode;
  timeWindow: ExploreTimeWindow;
  onSortMode: (mode: ExploreSortMode) => void;
  onOpenRow: (item: TokenExploreItem) => void;
};

export function ExploreTableMode(props: Props) {
  const { authenticated } = usePointerAuth();
  const { buyToken, busyMint } = usePulseQuickBuy();
  const quickSol = usePulseColumnStore((s) => s.byColumn.new.quickBuySol);
  const buyAmt =
    typeof quickSol === 'number' && Number.isFinite(quickSol) && quickSol > 0 ? quickSol : BUY_PRESETS_SOL[1]!;
  const { items, sortMode, onSortMode, timeWindow } = props;

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border-subtle bg-bg-base shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
      <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] border-collapse text-left text-[11.5px]">
          <thead>
            <tr className="border-b border-border-subtle bg-desk-a text-[9.5px] font-semibold uppercase tracking-[0.1em] text-fg-muted">
              <Th>Token</Th>
              <ThButton active={sortMode === 'mindshare'} onClick={() => onSortMode('mindshare')}>
                Mindshare
              </ThButton>
              <Th>Wallets</Th>
              <Th>Fresh</Th>
              <Th>KOLs</Th>
              <Th>Smart</Th>
              <Th>Mcap</Th>
              <Th>Liq</Th>
              <ThButton active={sortMode === 'volume'} onClick={() => onSortMode('volume')} hint={`Window ${timeWindow}`}>
                Volume
              </ThButton>
              <Th>Risk</Th>
              <Th narrow>Buy</Th>
              <Th narrow>Open</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => (
              <tr
                key={it.tokenAddress}
                className={cn(
                  'cursor-pointer border-b border-border-subtle transition hover:bg-bg-hover',
                  idx % 2 === 1 ? 'bg-desk-b/80' : '',
                )}
                onClick={() => props.onOpenRow(it)}
              >
                <Td>
                  <div className="flex items-center gap-2.5 py-2">
                    <div className="h-8 w-8 shrink-0 overflow-hidden rounded-lg bg-black/40 ring-1 ring-white/[0.1]">
                      {it.iconUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={it.iconUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-white/72">
                          {it.ticker.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 font-semibold text-fg-primary">
                        <span>{it.ticker}</span>
                        {it.ageLabel ? <span className="font-normal text-fg-muted">{it.ageLabel}</span> : null}
                      </div>
                      <button
                        type="button"
                        className="block max-w-[220px] truncate text-left font-mono text-[9.5px] text-fg-muted hover:text-accent-primary"
                        title="Copy address"
                        onClick={(e) => {
                          e.stopPropagation();
                          void navigator.clipboard
                            .writeText(it.tokenAddress)
                            .then(() => toastCopied(it.tokenAddress))
                            .catch(() => toastCopyFailed());
                        }}
                      >
                        {shortenAddress(it.tokenAddress, 6)}
                      </button>
                    </div>
                  </div>
                </Td>
                <Td className="tabular-nums font-semibold text-accent-primary/98">{it.mindshareScore.toFixed(1)}</Td>
                <Td className="tabular-nums text-fg-secondary">{it.trackedWalletBuys ?? '—'}</Td>
                <Td className="tabular-nums text-fg-secondary">{it.freshWalletBuys ?? '—'}</Td>
                <Td className="tabular-nums text-fg-secondary">{it.kolMentionCount ?? '—'}</Td>
                <Td className="tabular-nums text-fg-secondary">{it.smartWalletBuys ?? '—'}</Td>
                <Td className="tabular-nums font-medium text-fg-primary">{formatCompactUsd(it.marketCap)}</Td>
                <Td className="tabular-nums text-fg-muted">{formatCompactUsd(it.liquidity)}</Td>
                <Td className="tabular-nums font-medium text-fg-primary">
                  {formatCompactUsd(it.volumeWindow ?? it.volume24h)}
                </Td>
                <Td className="tabular-nums text-rose-200/82">{Math.round(it.riskScore)}</Td>
                <Td narrow>
                  <div onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      disabled={busyMint !== null || !authenticated}
                      title={!authenticated ? 'Sign in to trade' : undefined}
                      onClick={() => void buyToken(it.tokenAddress, buyAmt)}
                      className={cn(
                        'rounded-lg bg-accent-primary px-2.5 py-1 text-[10px] font-semibold text-fg-inverse',
                        'disabled:opacity-35',
                      )}
                    >
                      {busyMint === it.tokenAddress ? <Loader2 className="mx-auto h-3.5 w-3.5 animate-spin" /> : buyAmt}
                    </button>
                  </div>
                </Td>
                <Td narrow>
                  <div onClick={(e) => e.stopPropagation()}>
                    <Link
                      href={`/token/${encodeURIComponent(it.tokenAddress)}`}
                      className="inline-flex rounded-lg border border-border-subtle px-2.5 py-1 text-[10px] font-semibold text-fg-secondary hover:bg-bg-hover"
                    >
                      View
                    </Link>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
      <p className="shrink-0 border-t border-border-subtle px-3 py-2 text-[9.5px] text-fg-muted">
        Table mirrors the cohort after your filters · deep tape + sparklines stay on token pages.
      </p>
    </div>
  );
}

function Th({ children, narrow }: { children: ReactNode; narrow?: boolean }) {
  return <th className={cn('px-3 py-2.5', narrow ? 'w-px whitespace-nowrap' : '')}>{children}</th>;
}

function ThButton({
  children,
  active,
  onClick,
  hint,
  narrow,
}: {
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
  hint?: string;
  narrow?: boolean;
}) {
  return (
    <th className={cn('px-3 py-2.5', narrow ? 'w-px whitespace-nowrap' : '')}>
      <button
        type="button"
        onClick={onClick}
        title={hint}
        className={cn(
          'rounded px-0.5 py-px text-[9.5px] font-semibold uppercase tracking-[0.1em] hover:text-accent-primary',
          active ? 'text-accent-primary' : '',
        )}
      >
        {children}
      </button>
    </th>
  );
}

function Td({ children, className, narrow }: { children: ReactNode; className?: string; narrow?: boolean }) {
  return <td className={cn('px-3 align-middle', narrow ? 'w-px whitespace-nowrap' : '', className)}>{children}</td>;
}
