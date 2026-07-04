'use client';

import { useMemo, useState, type MouseEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { History, LineChart, Settings, Star, Zap } from 'lucide-react';
import { TokenImage } from '@/components/shared/TokenImage';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { appChainForMintNavigation } from '@/lib/chains/mintKind';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { formatCompactUsd } from '@/lib/utils/formatters';
import { cn } from '@/lib/utils/cn';
import type { TickerBarMode } from '@/lib/watchlist/watchlistModel';
import type { WatchlistItem } from '@/lib/watchlist/watchlistModel';
import { filterTradeTokenPositions } from '@/lib/portfolio/tradePositions';
import { fetchPortfolioJson } from '@/lib/portfolio/portfolioQuery';
import { useWatchlistStore } from '@/store/watchlist';
import { useRecentTokenVisitsStore } from '@/store/recentTokenVisits';
import { useUIStore } from '@/store/ui';
import { BUY_PRESETS_SOL } from '@/lib/utils/constants';
import { useDeferredMount } from '@/lib/hooks/useDeferredMount';

type TickerRowItem = {
  mint: string;
  symbol: string | null;
  name: string | null;
  imageUrl: string | null;
  marketCapUsd: number | null;
};

function sortWatchlistItems(
  items: WatchlistItem[],
  sortKey: 'price' | 'added' | 'symbol',
  sortDir: 'asc' | 'desc',
): WatchlistItem[] {
  const dir = sortDir === 'asc' ? 1 : -1;
  const copy = [...items];
  copy.sort((a, b) => {
    let diff = 0;
    if (sortKey === 'price') {
      diff = (a.marketCapUsd ?? 0) - (b.marketCapUsd ?? 0);
    } else if (sortKey === 'symbol') {
      diff = (a.symbol ?? a.mint).localeCompare(b.symbol ?? b.mint, undefined, {
        sensitivity: 'base',
      });
    } else {
      diff = a.addedAt - b.addedAt;
    }
    return diff * dir;
  });
  return copy;
}

function TickerBarPill({
  item,
  quickbuyMode,
  quickBuySol,
  onRemove,
  showRemove,
}: {
  item: TickerRowItem;
  quickbuyMode: 'never' | 'always' | 'hover';
  quickBuySol: number;
  onRemove?: () => void;
  showRemove?: boolean;
}) {
  const router = useRouter();
  const activeChain = useUIStore((s) => s.activeChain);
  const [hovered, setHovered] = useState(false);

  const label = item.symbol?.trim() || item.name?.trim() || item.mint.slice(0, 4);
  const mc =
    item.marketCapUsd != null && Number.isFinite(item.marketCapUsd)
      ? formatCompactUsd(item.marketCapUsd)
      : '—';

  const showQuickbuy =
    quickbuyMode === 'always' || (quickbuyMode === 'hover' && hovered);

  const openToken = () => {
    const chain = appChainForMintNavigation(item.mint, activeChain);
    useUIStore.getState().setActiveChain(chain);
    router.push(`/token/${encodeURIComponent(item.mint)}`);
  };

  const quickBuy = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const chain = appChainForMintNavigation(item.mint, activeChain);
    useUIStore.getState().setActiveChain(chain);
    router.push(
      `/token/${encodeURIComponent(item.mint)}?buySol=${encodeURIComponent(String(quickBuySol))}`,
    );
  };

  return (
    <div
      className="group/pill relative shrink-0"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        type="button"
        onClick={openToken}
        className={cn(
          'flex h-7 max-w-[9.5rem] items-center gap-1.5 rounded-md border px-1.5',
          'transition-[background-color,border-color] duration-200 ease-out',
          hovered
            ? 'border-white/[0.12] bg-white/[0.06]'
            : 'border-transparent bg-transparent hover:border-white/[0.08] hover:bg-white/[0.04]',
        )}
        title={`Open ${label}`}
      >
        <TokenImage
          src={item.imageUrl}
          alt=""
          size={16}
          className="!h-4 !w-4 shrink-0 rounded-[5px] ring-1 ring-white/[0.08]"
        />
        <span className="truncate text-[11px] font-medium text-fg-primary">{label}</span>
        <span className="shrink-0 text-[10px] tabular-nums text-fg-muted">{mc}</span>
        {showQuickbuy ? (
          <span
            role="button"
            tabIndex={0}
            onClick={quickBuy}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                quickBuy(e as unknown as MouseEvent);
              }
            }}
            className="ml-0.5 flex shrink-0 items-center gap-0.5 rounded-full bg-accent-primary/20 px-1.5 py-0.5 text-[9px] font-bold text-accent-primary transition hover:bg-accent-primary/30"
            title={`Quick buy ${quickBuySol} SOL`}
          >
            <Zap className="h-2.5 w-2.5" strokeWidth={2.5} />
            {quickBuySol}
          </span>
        ) : null}
      </button>
      {showRemove && onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full border border-border-subtle bg-bg-raised text-[9px] text-fg-muted group-hover/pill:flex hover:text-signal-bear"
          aria-label={`Remove ${label} from watchlist`}
          title="Remove from watchlist"
        >
          ×
        </button>
      ) : null}
    </div>
  );
}

function TickerModeButton({
  active,
  onClick,
  tooltip,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  tooltip: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          className={cn(
            'btn-press flex h-6 items-center gap-1 rounded-md px-1.5 transition-colors duration-200',
            active
              ? 'text-accent-primary hover:bg-white/[0.06]'
              : 'text-fg-muted hover:bg-white/[0.06] hover:text-fg-primary',
          )}
          aria-label={tooltip}
          aria-pressed={active}
        >
          {children}
          {active ? (
            <span className="hidden text-[10px] font-semibold uppercase tracking-wide sm:inline">
              {label}
            </span>
          ) : null}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-[11px]">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

/** Axiom-style compact watchlist row — sits directly under the top bar. */
export function WatchlistTickerBar() {
  const items = useWatchlistStore((s) => s.items);
  const settings = useWatchlistStore((s) => s.settings);
  const updateItemMarketCap = useWatchlistStore((s) => s.updateItemMarketCap);
  const removeItem = useWatchlistStore((s) => s.removeItem);
  const setTickerMode = useWatchlistStore((s) => s.setTickerMode);
  const recentVisits = useRecentTokenVisitsStore((s) => s.visits);
  const openSettings = useUIStore((s) => s.openSettings);
  const { authenticated, getAccessToken } = usePointerAuth();

  const tickerMode: TickerBarMode = settings.tickerMode ?? 'watchlist';

  const sortedWatchlist = useMemo(
    () => sortWatchlistItems(items, settings.sortKey, settings.sortDir),
    [items, settings.sortKey, settings.sortDir],
  );

  const positionsQ = useQuery({
    queryKey: ['ticker-bar-positions'],
    queryFn: async () => {
      const json = await fetchPortfolioJson<{
        positions?: Array<{
          mint: string;
          symbol?: string | null;
          imageUrl?: string | null;
          valueUsd?: number | null;
        }>;
      }>(getAccessToken, null, { tradesLimit: 0, fifoLimit: 0 });
      return filterTradeTokenPositions(json.positions ?? []);
    },
    enabled: authenticated && tickerMode === 'active_positions',
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const rowItems = useMemo((): TickerRowItem[] => {
    if (tickerMode === 'watchlist') {
      return sortedWatchlist.map((item) => ({
        mint: item.mint,
        symbol: item.symbol,
        name: item.name,
        imageUrl: item.imageUrl,
        marketCapUsd: item.marketCapUsd,
      }));
    }
    if (tickerMode === 'recent_pairs') {
      return recentVisits.map((v) => ({
        mint: v.mint,
        symbol: v.symbol,
        name: v.name,
        imageUrl: v.imageUrl,
        marketCapUsd: v.marketCapUsd,
      }));
    }
    return (positionsQ.data ?? []).map((p) => ({
      mint: p.mint,
      symbol: p.symbol ?? null,
      name: null,
      imageUrl: p.imageUrl ?? null,
      marketCapUsd: p.valueUsd ?? null,
    }));
  }, [tickerMode, sortedWatchlist, recentVisits, positionsQ.data]);

  const mintsKey = useMemo(() => rowItems.map((i) => i.mint).join(','), [rowItems]);
  const mcRefreshReady = useDeferredMount(2_500);

  useQuery({
    queryKey: ['watchlist-mc-refresh', tickerMode, mintsKey],
    queryFn: async () => {
      await Promise.all(
        rowItems.slice(0, 8).map(async (item) => {
          try {
            const res = await fetch(`/api/tokens/${encodeURIComponent(item.mint)}`);
            if (!res.ok) return;
            const json = (await res.json()) as {
              snapshot?: { market_cap_usd?: number | null };
            };
            const mc = json.snapshot?.market_cap_usd ?? null;
            if (mc != null && Number.isFinite(mc)) {
              if (tickerMode === 'watchlist') {
                updateItemMarketCap(item.mint, mc);
              }
            }
          } catch {
            /* ignore refresh errors */
          }
        }),
      );
      return true;
    },
    enabled: rowItems.length > 0 && mcRefreshReady && tickerMode === 'watchlist',
    staleTime: 60_000,
    refetchInterval: 90_000,
  });

  if (!settings.showTicker) return null;

  const quickBuySol = BUY_PRESETS_SOL[1] ?? BUY_PRESETS_SOL[0] ?? 0.1;

  return (
    <div
      className={cn(
        'flex h-[var(--app-watchlist-bar-h)] min-h-[var(--app-watchlist-bar-h)] shrink-0 items-center gap-2',
        'border-b border-white/[0.06] bg-bg-base',
        // Shift clear of an edge-docked side panel (wallet / X-monitor / pulse /
        // squads) so the bar starts where the dock ends instead of hiding under
        // it. Base gutter folded into the max() so spacing is unchanged with no
        // dock open. Mirrors <main> + PulseChromeStack.
        'pl-[max(0.5rem,var(--pulse-dock-pad-left,0px),var(--wallet-dock-pad-left,0px),var(--x-monitor-dock-pad-left,0px),var(--squads-dock-pad-left,0px))]',
        'pr-[max(0.5rem,var(--pulse-dock-pad-right,0px),var(--wallet-dock-pad-right,0px),var(--x-monitor-dock-pad-right,0px),var(--squads-dock-pad-right,0px))]',
        'transition-[padding] duration-200 ease-out',
      )}
    >
      <div className="flex shrink-0 items-center gap-0.5 border-r border-white/[0.06] pr-2">
        <button
          type="button"
          onClick={() => openSettings('watchlist')}
          className="btn-press flex h-6 w-6 items-center justify-center rounded-md text-fg-muted transition-colors duration-200 hover:bg-white/[0.06] hover:text-fg-primary"
          aria-label="Watchlist settings"
          title="Watchlist settings"
        >
          <Settings className="h-3.5 w-3.5" strokeWidth={2} />
        </button>

        <TickerModeButton
          active={tickerMode === 'watchlist'}
          onClick={() => setTickerMode('watchlist')}
          tooltip="Watchlist"
          label="Watchlist"
        >
          <Star
            className="h-3.5 w-3.5"
            strokeWidth={2}
            fill={tickerMode === 'watchlist' ? 'currentColor' : 'none'}
          />
        </TickerModeButton>

        <TickerModeButton
          active={tickerMode === 'active_positions'}
          onClick={() => setTickerMode('active_positions')}
          tooltip="Active Positions"
          label="Active Positions"
        >
          <LineChart className="h-3.5 w-3.5" strokeWidth={2} />
        </TickerModeButton>

        <TickerModeButton
          active={tickerMode === 'recent_pairs'}
          onClick={() => setTickerMode('recent_pairs')}
          tooltip="Recent Pairs"
          label="Recent Pairs"
        >
          <History className="h-3.5 w-3.5" strokeWidth={2} />
        </TickerModeButton>
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {rowItems.length === 0 ? (
          <span className="shrink-0 px-1 text-[11px] text-fg-muted">
            {tickerMode === 'watchlist'
              ? 'Star tokens on the desk to pin them here'
              : tickerMode === 'active_positions'
                ? authenticated
                  ? 'No open positions'
                  : 'Connect wallet to see positions'
                : 'Open tokens to see recent pairs'}
          </span>
        ) : (
          rowItems.map((item) => (
            <TickerBarPill
              key={item.mint}
              item={item}
              quickbuyMode={settings.quickbuyMode}
              quickBuySol={quickBuySol}
              showRemove={tickerMode === 'watchlist'}
              onRemove={tickerMode === 'watchlist' ? () => removeItem(item.mint) : undefined}
            />
          ))
        )}
      </div>
    </div>
  );
}
