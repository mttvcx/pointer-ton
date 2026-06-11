'use client';

import { useMemo, useState, type MouseEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Settings, Star, Zap } from 'lucide-react';
import { TokenImage } from '@/components/shared/TokenImage';
import { appChainForMintNavigation } from '@/lib/chains/mintKind';
import { formatCompactUsd } from '@/lib/utils/formatters';
import { cn } from '@/lib/utils/cn';
import type { WatchlistItem } from '@/lib/watchlist/watchlistModel';
import { useWatchlistStore } from '@/store/watchlist';
import { useUIStore } from '@/store/ui';
import { BUY_PRESETS_SOL } from '@/lib/utils/constants';
import { useDeferredMount } from '@/lib/hooks/useDeferredMount';

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

function WatchlistTickerPill({
  item,
  quickbuyMode,
  quickBuySol,
}: {
  item: WatchlistItem;
  quickbuyMode: 'never' | 'always' | 'hover';
  quickBuySol: number;
}) {
  const router = useRouter();
  const activeChain = useUIStore((s) => s.activeChain);
  const removeItem = useWatchlistStore((s) => s.removeItem);
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
        <span className="truncate text-[11px] font-semibold text-fg-primary">{label}</span>
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
      <button
        type="button"
        onClick={() => removeItem(item.mint)}
        className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full border border-border-subtle bg-bg-raised text-[9px] text-fg-muted group-hover/pill:flex hover:text-signal-bear"
        aria-label={`Remove ${label} from watchlist`}
        title="Remove from watchlist"
      >
        ×
      </button>
    </div>
  );
}

/** Axiom-style compact watchlist row — sits directly under the top bar. */
export function WatchlistTickerBar() {
  const items = useWatchlistStore((s) => s.items);
  const settings = useWatchlistStore((s) => s.settings);
  const updateItemMarketCap = useWatchlistStore((s) => s.updateItemMarketCap);
  const openSettings = useUIStore((s) => s.openSettings);

  const sorted = useMemo(
    () => sortWatchlistItems(items, settings.sortKey, settings.sortDir),
    [items, settings.sortKey, settings.sortDir],
  );

  const mintsKey = useMemo(() => sorted.map((i) => i.mint).join(','), [sorted]);
  const mcRefreshReady = useDeferredMount(2_500);

  useQuery({
    queryKey: ['watchlist-mc-refresh', mintsKey],
    queryFn: async () => {
      await Promise.all(
        sorted.slice(0, 8).map(async (item) => {
          try {
            const res = await fetch(`/api/tokens/${encodeURIComponent(item.mint)}`);
            if (!res.ok) return;
            const json = (await res.json()) as {
              snapshot?: { market_cap_usd?: number | null };
            };
            const mc = json.snapshot?.market_cap_usd ?? null;
            if (mc != null && Number.isFinite(mc)) {
              updateItemMarketCap(item.mint, mc);
            }
          } catch {
            /* ignore refresh errors */
          }
        }),
      );
      return true;
    },
    enabled: sorted.length > 0 && mcRefreshReady,
    staleTime: 60_000,
    refetchInterval: 90_000,
  });

  if (!settings.showTicker) return null;

  const quickBuySol = BUY_PRESETS_SOL[1] ?? BUY_PRESETS_SOL[0] ?? 0.1;

  return (
    <div
      className={cn(
        'flex h-[var(--app-watchlist-bar-h)] min-h-[var(--app-watchlist-bar-h)] shrink-0 items-center gap-2',
        'border-b border-white/[0.06] bg-bg-base px-2 sm:px-2.5',
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
        <Link
          href="/pulse"
          className="btn-press flex h-6 w-6 items-center justify-center rounded-md text-fg-muted transition-colors duration-200 hover:bg-white/[0.06] hover:text-accent-primary"
          aria-label="Pulse"
          title="Pulse"
        >
          <Star className="h-3.5 w-3.5" strokeWidth={2} />
        </Link>
        {/* Chart overlays / linked tokens buttons removed until implemented — no toast-only icons. */}
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {sorted.length === 0 ? (
          <p className="truncate px-1 text-[11px] text-fg-muted">
            Star a token on its page to pin it here — open Settings → Watchlist to configure.
          </p>
        ) : (
          sorted.map((item) => (
            <WatchlistTickerPill
              key={item.mint}
              item={item}
              quickbuyMode={settings.quickbuyMode}
              quickBuySol={quickBuySol}
            />
          ))
        )}
      </div>
    </div>
  );
}
