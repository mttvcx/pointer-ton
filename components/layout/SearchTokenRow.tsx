'use client';

import { formatDistanceToNowStrict, subMilliseconds } from 'date-fns';
import { Copy, Globe, Loader2, Shield, Zap } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { TokenImage } from '@/components/shared/TokenImage';
import { Popover } from '@/components/ui/popover';
import { usePulseQuickBuy } from '@/lib/hooks/usePulseQuickBuy';
import { spendAssetLabel } from '@/lib/trading/spendAsset';
import { shortenAddress } from '@/lib/utils/addresses';
import { formatCompactUsd, formatNumber } from '@/lib/utils/formatters';
import { cn } from '@/lib/utils/cn';
import { searchModalRowHoverClass } from '@/lib/ui/searchModalChrome';
import type { SearchQuickBuyChrome, SearchQuickBuySize } from '@/store/searchModalPrefs';
import { useTradingStore } from '@/store/trading';
import { useUIStore } from '@/store/ui';

export type SearchRowModel = {
  mint: string;
  symbol: string | null;
  name: string | null;
  image_url: string | null;
  mockMc: number;
  mockVol: number;
  mockLiq: number;
  mockAgeMs: number;
  dexLabel: string;
};

function formatBuyAmount(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0';
  if (n >= 100) return String(Math.round(n));
  if (Number.isInteger(n)) return String(n);
  return formatNumber(n, { decimals: 2 });
}

function quickBuyButtonClasses(
  size: SearchQuickBuySize,
  chrome: SearchQuickBuyChrome,
): string {
  const base =
    'focus-ring relative flex shrink-0 flex-col items-center justify-center rounded-md border-0 font-semibold tabular-nums transition-all duration-200 disabled:pointer-events-none disabled:opacity-55';
  const dim =
    size === 'small'
      ? 'h-9 min-w-[56px] gap-0 px-1.5 text-[9px]'
      : size === 'large'
        ? 'h-11 min-w-[68px] gap-0.5 px-2 text-[10px]'
        : size === 'mega'
          ? 'h-12 min-w-[76px] gap-0.5 px-2 text-[11px]'
          : 'h-[52px] min-w-[72px] gap-1 px-2 pb-2 text-[10px]';

  if (chrome === 'accent') {
    return cn(
      base,
      dim,
      'bg-white/[0.08] text-fg-primary hover:bg-white/[0.14] hover:backdrop-blur-sm',
    );
  }
  if (chrome === 'filled') {
    return cn(
      base,
      dim,
      'bg-emerald-400 text-[#030806] hover:bg-emerald-300',
    );
  }
  return cn(
    base,
    dim,
    'bg-transparent text-emerald-400 hover:bg-emerald-400/[0.1] hover:backdrop-blur-sm',
  );
}

export function SearchTokenRow({
  row,
  compact,
  rowPadding,
  quickBuySize,
  quickBuyChrome,
  quickBuyAmount,
  onCloseSearch,
  showBadgeDot,
}: {
  row: SearchRowModel;
  compact: boolean;
  rowPadding: string;
  quickBuySize: SearchQuickBuySize;
  quickBuyChrome: SearchQuickBuyChrome;
  quickBuyAmount: number;
  onCloseSearch: () => void;
  showBadgeDot?: boolean;
}) {
  const activeChain = useUIStore((s) => s.activeChain);
  const spendAsset = useTradingStore((s) => s.spendAsset);
  const { buyToken, busyMint } = usePulseQuickBuy();
  const [copyOpen, setCopyOpen] = useState(false);

  const sym = row.symbol?.trim() ?? '';
  const name = row.name?.trim() ?? '';
  const symbolTitle = sym || shortenAddress(row.mint, 4);
  const nameMuted =
    name && name.toLowerCase() !== symbolTitle.toLowerCase() ? name : shortenAddress(row.mint, 5);
  const ageLabel = formatDistanceToNowStrict(subMilliseconds(new Date(), row.mockAgeMs), {
    addSuffix: false,
  });
  const spend: 'sol' | 'usdc' = spendAsset === 'usdc' ? 'usdc' : 'sol';
  const quote = activeChain === 'sol' ? spendAssetLabel(spend) : spendAssetLabel('sol');
  const buyLabel = formatBuyAmount(quickBuyAmount);
  const loading = busyMint === row.mint;

  async function copyText(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
      setCopyOpen(false);
    } catch {
      toast.error('Copy failed');
    }
  }

  return (
    <li className={cn('group flex items-stretch gap-1.5', rowPadding)}>
      <Link
        href={`/token/${encodeURIComponent(row.mint)}`}
        onClick={onCloseSearch}
        className={cn(
          'focus-ring flex min-w-0 flex-1 items-center gap-2 rounded-md py-0.5 pr-1',
          searchModalRowHoverClass,
        )}
      >
        <div className="relative shrink-0">
          <TokenImage
            src={row.image_url}
            alt={symbolTitle}
            size={compact ? 40 : 44}
            className="rounded-sm"
          />
          {showBadgeDot ? (
            <span
              className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-bg-raised bg-signal-warn"
              title="Launch status"
            />
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
          <div className="group/mintTitle flex min-w-0 max-w-full w-max flex-col overflow-hidden">
            <div
              className={cn(
                'inline-flex w-fit max-w-full items-center gap-1 overflow-hidden rounded-sm px-0.5 -mx-0.5',
                'transition-colors hover:bg-white/[0.06]',
              )}
            >
            <span className="truncate text-sm font-semibold text-fg-primary">{symbolTitle}</span>
            <Popover.Root open={copyOpen} onOpenChange={setCopyOpen}>
              <Popover.Trigger asChild>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  className={cn(
                    'focus-ring shrink-0 rounded-sm p-0.5 text-fg-muted opacity-0 transition group-hover/mintTitle:opacity-100',
                    copyOpen && 'opacity-100 text-fg-secondary',
                  )}
                  aria-label="Copy options"
                >
                  <Copy className="h-3 w-3" />
                </button>
              </Popover.Trigger>
              <Popover.Content
                align="start"
                className="z-[700] w-52 rounded-lg border border-white/[0.08] bg-bg-raised/95 p-1 text-xs shadow-xl backdrop-blur-xl"
              >
                <button
                  type="button"
                  className="w-full rounded-md px-2 py-1.5 text-left text-fg-secondary hover:bg-white/[0.06]"
                  onClick={(e) => {
                    e.stopPropagation();
                    void copyText(row.mint, 'Contract');
                  }}
                >
                  Copy {shortenAddress(row.mint, 4)}
                </button>
                {sym ? (
                  <button
                    type="button"
                    className="w-full rounded-md px-2 py-1.5 text-left text-fg-secondary hover:bg-white/[0.06]"
                    onClick={(e) => {
                      e.stopPropagation();
                      void copyText(sym, 'Ticker');
                    }}
                  >
                    Copy {sym}
                  </button>
                ) : null}
              </Popover.Content>
            </Popover.Root>
            </div>
            <span className="truncate text-[11px] text-fg-muted">{nameMuted}</span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
            <span className="font-medium text-fg-secondary">{ageLabel}</span>
            <span className="text-[10px] text-fg-muted">{row.dexLabel}</span>
            <span className="flex items-center gap-1 text-fg-muted">
              <Globe className="h-3 w-3 shrink-0" aria-hidden />
              <Shield className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
            </span>
          </div>
        </div>

        <div className="grid shrink-0 grid-cols-3 gap-x-3 font-mono tabular-nums sm:gap-x-4">
          <div className="text-right">
            <div className="text-[10px] text-fg-muted">MC</div>
            <div className="text-[13px] font-semibold leading-tight text-fg-primary">
              {formatCompactUsd(row.mockMc)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-fg-muted">V</div>
            <div className="text-[13px] font-semibold leading-tight text-fg-primary">
              {formatCompactUsd(row.mockVol)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-fg-muted">L</div>
            <div className="text-[13px] font-semibold leading-tight text-fg-primary">
              {formatCompactUsd(row.mockLiq)}
            </div>
          </div>
        </div>
      </Link>

      {activeChain === 'sol' ? (
        <button
          type="button"
          disabled={loading}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void buyToken(row.mint, quickBuyAmount, {
              spendAsset: spendAsset === 'usdc' ? 'usdc' : 'sol',
            });
          }}
          className={quickBuyButtonClasses(quickBuySize, quickBuyChrome)}
          title={`Quick buy ${buyLabel} ${quote}`}
          aria-label={`Quick buy ${buyLabel} ${quote}`}
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <>
              <Zap
                className={cn(
                  'h-3.5 w-3.5 shrink-0',
                  quickBuyChrome === 'filled'
                    ? 'fill-[#030806] text-[#030806]'
                    : quickBuyChrome === 'accent'
                      ? 'fill-current'
                      : 'fill-emerald-400/35 text-emerald-400',
                )}
                aria-hidden
              />
              <span className="min-w-0 text-center leading-none">
                {quickBuySize === 'ultra' ? `${buyLabel} ${quote}` : 'Buy'}
              </span>
            </>
          )}
        </button>
      ) : (
        <Link
          href={`/token/${encodeURIComponent(row.mint)}`}
          onClick={onCloseSearch}
          className="focus-ring flex h-9 shrink-0 items-center justify-center rounded-md border-0 bg-white/[0.06] px-2.5 text-[11px] font-semibold text-fg-secondary transition hover:bg-white/[0.1] hover:text-fg-primary hover:backdrop-blur-sm"
        >
          View
        </Link>
      )}
    </li>
  );
}
