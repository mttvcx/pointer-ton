'use client';

import { useCallback, useMemo } from 'react';
import { Bell, ExternalLink, Search, Share2, Star } from 'lucide-react';
import { toast } from 'sonner';
import { StockAvatar } from '@/components/stocks/StockAvatar';
import type { SyntheticStockMarket } from '@/lib/stocks/types';
import { openAlertRulesModal } from '@/components/alerts/AlertRulesModal';
import {
  formatCompactUsd,
  formatNumber,
  formatPercent,
  formatPriceUsd,
} from '@/lib/utils/formatters';
import { cn } from '@/lib/utils/cn';
import { useUIStore } from '@/store/ui';
import { useWatchlistStore } from '@/store/watchlist';

const iconRow =
  'inline-flex h-4 w-4 shrink-0 cursor-pointer text-fg-muted transition-colors hover:text-fg-primary';

const HEADER_AVATAR_PX = 48;

function watchlistMint(symbol: string): string {
  return `stock:${symbol}`;
}

export function StockHeader({ market }: { market: SyntheticStockMarket }) {
  const ticker = market.symbol;
  const name = market.name;
  const wlMint = watchlistMint(ticker);

  const setSearchOpen = useUIStore((s) => s.setSearchOpen);
  const watchlisted = useWatchlistStore((s) => s.items.some((i) => i.mint === wlMint));
  const toggleWatchlist = useWatchlistStore((s) => s.toggleItem);
  const setShowTicker = useWatchlistStore((s) => s.setShowTicker);

  const priceStr = formatPriceUsd(market.priceUsd);
  const volumeStr = formatCompactUsd(market.volume24hUsd);
  const mcStr = formatCompactUsd(market.marketCapUsd);
  const oiStr =
    market.openInterestUsd != null ? formatCompactUsd(market.openInterestUsd) : '\u2014';
  const fundingStr =
    market.fundingRatePct != null
      ? `${(market.fundingRatePct * 100).toFixed(3)}%`
      : '\u2014';
  const liquidityStr =
    market.liquidityUsd != null ? formatCompactUsd(market.liquidityUsd) : '\u2014';

  const focalPrimary = mcStr !== '\u2014' ? mcStr : priceStr;
  const priceChangePct = market.change24hPct;

  const shareLink = useCallback(async () => {
    const url = `${window.location.origin}/stock/${encodeURIComponent(ticker)}`;
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: `${ticker} on Pointer`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success('Link copied');
    } catch {
      /* dismissed */
    }
  }, [ticker]);

  const stats = useMemo(
    () => [
      { label: 'Price', value: priceStr },
      { label: 'Volume', value: volumeStr },
      { label: 'Liquidity', value: liquidityStr },
      { label: 'Open int.', value: oiStr },
      { label: 'Funding', value: fundingStr },
      {
        label: '24h',
        value: formatPercent(priceChangePct, { sign: true, decimals: 2 }),
        change: true as const,
      },
    ],
    [priceStr, volumeStr, liquidityStr, oiStr, fundingStr, priceChangePct],
  );

  return (
    <div className="relative z-20 min-w-0 overflow-visible border-b border-white/[0.06] bg-bg-raised font-sans">
      <div className="flex min-w-0 items-center overflow-visible px-2.5 sm:px-3">
        <div className="flex min-w-0 shrink-0 items-center gap-2 py-2.5">
          <div className="relative shrink-0 overflow-visible pr-1.5 pb-1.5">
            <StockAvatar symbol={ticker} size={HEADER_AVATAR_PX} className="shrink-0 rounded-md" />
          </div>

          <div className="flex min-w-0 flex-col justify-center gap-0.5 overflow-visible">
            <div className="flex min-w-0 items-center gap-1.5 overflow-visible">
              <span className="truncate text-[15px] font-bold leading-none tracking-tight text-fg-primary sm:text-base">
                {ticker}
              </span>
              <span className="min-w-0 truncate text-[12px] font-medium leading-none text-fg-muted">
                {name}
              </span>
              <button
                type="button"
                className={cn(iconRow, 'rounded-sm')}
                aria-label="Share"
                title="Share"
                onClick={() => void shareLink()}
              >
                <Share2 className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
              <button
                type="button"
                className={cn(iconRow, watchlisted && 'text-accent-primary')}
                aria-label={watchlisted ? 'Remove from watchlist' : 'Add to watchlist'}
                title={watchlisted ? 'Remove from watchlist' : 'Add to watchlist'}
                onClick={() => {
                  const was = watchlisted;
                  toggleWatchlist({
                    mint: wlMint,
                    symbol: ticker,
                    name,
                    imageUrl: null,
                    marketCapUsd: market.marketCapUsd,
                  });
                  if (!was) {
                    setShowTicker(true);
                    toast.success('Added to watchlist');
                  } else {
                    toast.message('Removed from watchlist');
                  }
                }}
              >
                <Star className="h-3.5 w-3.5" strokeWidth={2} fill={watchlisted ? 'currentColor' : 'none'} />
              </button>
            </div>
          </div>
        </div>

        <div className="mx-2.5 hidden h-9 w-px shrink-0 bg-white/[0.08] sm:block" aria-hidden />

        <div className="scrollbar-thin flex min-w-0 flex-1 items-center overflow-x-auto py-2">
          <div className="flex shrink-0 items-center gap-3 sm:gap-4">
            <div className="flex shrink-0 flex-col justify-center">
              <span className="text-[1.25rem] font-bold tabular-nums leading-none tracking-tight text-fg-primary sm:text-[1.375rem]">
                {focalPrimary}
              </span>
              {Number.isFinite(priceChangePct) ? (
                <span
                  className={cn(
                    'mt-1 text-[10px] font-medium tabular-nums leading-none',
                    priceChangePct >= 0 ? 'text-signal-bull' : 'text-signal-bear',
                  )}
                >
                  {priceChangePct >= 0 ? '+' : ''}
                  {formatNumber(priceChangePct, { decimals: 2 })}%
                </span>
              ) : null}
            </div>

            <div className="hidden h-5 w-px shrink-0 bg-white/[0.08] sm:block" aria-hidden />

            <div className="flex shrink-0 items-start gap-x-3 sm:gap-x-4">
              {stats.map((stat) => {
                const muted =
                  stat.value === '\u2014' || stat.value === '\u2026' || stat.value === '';
                let valueClassName = muted ? 'text-fg-muted' : 'text-fg-primary';
                if ('change' in stat && stat.value !== '\u2014') {
                  valueClassName =
                    priceChangePct >= 0 ? 'text-signal-bull' : 'text-signal-bear';
                }
                return (
                  <div key={stat.label} className="flex min-w-[3.25rem] shrink-0 flex-col">
                    <span className="whitespace-nowrap text-[10px] font-medium uppercase leading-none tracking-[0.06em] text-fg-muted/85">
                      {stat.label}
                    </span>
                    <span
                      className={cn(
                        'mt-1 whitespace-nowrap text-[13px] font-semibold tabular-nums leading-none sm:text-[14px]',
                        valueClassName,
                      )}
                    >
                      {stat.value}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1 self-center py-2 pl-1">
          <span className="hidden h-4 w-px shrink-0 bg-border-subtle/50 sm:inline-block" aria-hidden />
          <button
            type="button"
            className={cn(iconRow, 'rounded-sm')}
            aria-label="Search"
            title="Search"
            onClick={() => setSearchOpen(true)}
          >
            <Search className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={() => openAlertRulesModal()}
            title="Pulse alerts"
            className={cn(iconRow, 'rounded-sm')}
            aria-label="Open Pulse alerts"
          >
            <Bell className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
          <a
            href={`/pulse`}
            className={cn('focus-ring inline-flex shrink-0 rounded-sm', iconRow)}
            aria-label="Back to Pulse"
            title="Pulse"
          >
            <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
          </a>
        </div>
      </div>
    </div>
  );
}
