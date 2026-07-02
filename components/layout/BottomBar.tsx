'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ChevronDown, Settings, Wallet, X } from 'lucide-react';
import { BugReportDrawer } from '@/components/reports/BugReportDrawer';
import { BottomBarStatusRail } from '@/components/layout/bottomBar/BottomBarStatusRail';
import { SandboxBadge } from '@/components/sandbox/SandboxBadge';
import { snapshotRecentClientErrors } from '@/lib/reports/clientErrorRing';
import { cn } from '@/lib/utils/cn';
import type { MyWalletRow } from '@/lib/hooks/useActiveSolanaWallet';
import { useDockTrackerHotkeys } from '@/lib/hooks/useDockTrackerHotkeys';
import { SpotTickerIcon } from '@/components/chains/SpotTickerIcon';
import { useActiveSolanaWallet } from '@/lib/hooks/useActiveSolanaWallet';
import { parseLamportsStringToSol } from '@/lib/utils/formatters';
import {
  DEFAULT_SPOT_TICKER_CHAINS,
  normalizeSpotTickerChains,
  spotTickerChainsForActiveChain,
  type SpotTickerSymbol,
} from '@/lib/chains/chainAssets';
import type { DockTrackerId, DockTrackerMode } from '@/lib/dock/dockTrackerConfig';
import {
  DOCK_TRACKER_HREF,
  dockTrackerLabel,
} from '@/lib/dock/dockTrackerConfig';
import { useUIStore } from '@/store/ui';
import { useTradingStore } from '@/store/trading';
import type { AppChainId } from '@/lib/chains/appChain';
import { WalletPickerPopover } from '@/components/wallets/WalletPickerPopover';
import { TerminalWalletChip } from '@/components/wallet/TerminalWalletChip';
import { TradingSettingsPopover } from '@/components/trading/TradingSettingsPopover';
import { DockTrackersSettingsModal } from '@/components/layout/DockTrackersSettingsModal';
import { MarketLighthouseHover } from '@/components/layout/MarketLighthouseHover';
import { DOCK_TRACKER_ICON } from '@/components/layout/dockTrackerUi';
import { normalizeDockModes, normalizeDockOrder, useDockTrackersStore } from '@/store/dockTrackers';
import { pickFreeDockSide, useTokenDockPeekStore } from '@/store/tokenDockPeek';
import { usePnlTrackerStore } from '@/store/pnlTracker';
import { openXMonitorOnPulse, toggleXMonitorOnPulse } from '@/lib/xMonitor/openXMonitorOnPulse';
import { usePulseTwitterRailStore } from '@/store/pulseTwitterRail';
import { toggleSquadsOnPulse, isSquadsRailOpen } from '@/lib/squads/openSquadsOnPulse';
import { usePulseSquadsRailStore } from '@/store/pulseSquadsRail';
import { useShellPrefsStore } from '@/store/shellPrefs';
import { bottomBarRegionById } from '@/lib/layout/bottomBarRegions';
import { useConnectionStatus } from '@/lib/hooks/useConnectionStatus';
import { useJupiterTickers } from '@/lib/hooks/useJupiterTickers';

type TickerRow = { symbol: string; usdPrice: number | null; priceChange24h: number | null };

/** Carousel slide height in px — viewport and transform must match exactly. */
const TICKER_LINE_PX = 28;

function TickerLine({ row }: { row: TickerRow }) {
  const ch = row.priceChange24h;
  const pct =
    ch != null && Number.isFinite(ch)
      ? `${ch >= 0 ? '+' : ''}${ch.toFixed(2)}%`
      : '\u2014';
  const price =
    row.usdPrice != null && Number.isFinite(row.usdPrice)
      ? `$${row.usdPrice < 1000 ? row.usdPrice.toFixed(2) : row.usdPrice.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
      : '\u2014';
  return (
    <>
      <span className="sr-only">{row.symbol}</span>
      <SpotTickerIcon symbol={row.symbol} />
      <span className="min-w-[4.75rem] tabular-nums text-[12px] text-white">{price}</span>
      <span
        className={cn(
          'min-w-[3.35rem] text-right tabular-nums text-[12px] transition-colors duration-150',
          ch != null && ch > 0
            ? 'text-signal-bull'
            : ch != null && ch < 0
              ? 'text-signal-bear'
              : 'text-fg-muted',
        )}
      >
        {pct}
      </span>
    </>
  );
}

function BottomBarVerticalTicker({
  rows,
  chain,
  symbols,
}: {
  rows: TickerRow[];
  chain: AppChainId;
  symbols: SpotTickerSymbol[];
}) {
  const order = spotTickerChainsForActiveChain(symbols, chain);
  const map = new Map(rows.map((r) => [r.symbol, r] as const));
  const resolved: TickerRow[] = order.map((sym) => {
    const hit = map.get(sym);
    return (
      hit ?? {
        symbol: sym,
        usdPrice: null,
        priceChange24h: null,
      }
    );
  });

  const dupFirst = resolved[0];
  const slides: TickerRow[] = dupFirst ? [...resolved, dupFirst] : [];

  const [ix, setIx] = useState(0);
  const [instant, setInstant] = useState(false);
  const prevIxRef = useRef(0);

  useEffect(() => {
    setIx(0);
  }, [slides.length, chain]);

  useEffect(() => {
    const n = slides.length;
    if (n <= 1) return undefined;
    const id = window.setInterval(() => {
      setIx((p) => (p + 1) % n);
    }, 3600);
    return () => window.clearInterval(id);
  }, [slides.length]);

  useEffect(() => {
    const prev = prevIxRef.current;
    if (slides.length <= 1) {
      prevIxRef.current = ix;
      return;
    }
    if (prev === slides.length - 1 && ix === 0) {
      setInstant(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setInstant(false)));
    }
    prevIxRef.current = ix;
  }, [ix, slides.length]);

  if (resolved.length === 0) return null;

  return (
    <div
      className="w-[280px] max-w-[46vw] overflow-hidden"
      style={{ height: TICKER_LINE_PX }}
      aria-live="polite"
      aria-label="Spot prices"
    >
      <div
        className="flex flex-col"
        style={{
          transform: `translateY(-${ix * TICKER_LINE_PX}px)`,
          transition: instant ? 'none' : 'transform 0.52s cubic-bezier(0.22, 1, 0.32, 1)',
        }}
      >
        {slides.map((row, slideIdx) => (
          <div
            key={`${row.symbol}-${slideIdx}`}
            className="flex shrink-0 items-center gap-3 whitespace-nowrap text-[12px] font-medium tabular-nums leading-none pointer-events-none"
            style={{ height: TICKER_LINE_PX, minHeight: TICKER_LINE_PX }}
          >
            <TickerLine row={row} />
          </div>
        ))}
      </div>
    </div>
  );
}

function IssuesIndicator({ onOpenDiagnostics }: { onOpenDiagnostics: () => void }) {
  const [count, setCount] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let active = true;
    const tick = () => {
      if (!active) return;
      setCount(snapshotRecentClientErrors().length);
    };
    tick();
    const id = window.setInterval(tick, 3000);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, []);

  // Hidden outside explicit debug chrome — end users use Diagnostics drawer instead.
  const debugChrome =
    process.env.NEXT_PUBLIC_POINTER_DEBUG_CHROME === '1' ||
    process.env.POINTER_DEBUG_CHROME === '1';
  if (!debugChrome) return null;
  if (dismissed || count === 0) return null;

  return (
    <span className="inline-flex h-5 items-center gap-1 rounded-md bg-rose-500/12 px-1.5 text-[10px] font-semibold text-rose-300">
      <AlertCircle className="h-3 w-3" strokeWidth={2} aria-hidden />
      <button
        type="button"
        onClick={onOpenDiagnostics}
        className="tabular-nums underline-offset-2 hover:underline"
        title="Open diagnostics"
      >
        {count} Issue{count === 1 ? '' : 's'}
      </button>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="rounded-sm p-0.5 text-rose-300/70 transition-colors hover:text-rose-200"
        aria-label="Dismiss issues badge"
      >
        <X className="h-2.5 w-2.5" strokeWidth={2.5} />
      </button>
    </span>
  );
}

export function BottomBar() {
  useDockTrackerHotkeys();
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const { getAccessToken, authenticated } = usePointerAuth();
  const activePresetSlot = useTradingStore((s) => s.activePresetSlot);
  const activeChain = useUIStore((s) => s.activeChain);

  const myWalletsQ = useQuery({
    queryKey: ['wallets-my'],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      const res = await fetch('/api/wallets/my', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('wallets');
      return res.json() as Promise<{ wallets: MyWalletRow[] }>;
    },
    enabled: authenticated,
    staleTime: 30_000,
  });

  const { activeAddress } = useActiveSolanaWallet(myWalletsQ.data?.wallets);

  // Shared `['jupiter-tickers']` cache (one network source across the shell).
  // Fetch once for the visible ticker, but only keep the 30s poll alive while
  // signed in — guests still see prices, they just don't drive background
  // polling. `useJupiterTickers` pauses polling when the tab is hidden.
  const tickersQ = useJupiterTickers({
    staleTime: 25_000,
    refetchInterval: authenticated ? 30_000 : false,
  });

  const rows = tickersQ.data ?? [];

  const rowForActive = myWalletsQ.data?.wallets?.find((w) => w.wallet_address === activeAddress);
  const solBal = parseLamportsStringToSol(rowForActive?.balance_lamports ?? null);

  const tonBalUi =
    activeChain === 'ton'
      ? parseLamportsStringToSol(rowForActive?.balance_lamports ?? null) ?? 0
      : null;

  const barBal =
    activeChain === 'sol' ? solBal : activeChain === 'ton' ? tonBalUi : null;

  const shortlistLen = useTradingStore((s) => (s.instantTradeWalletShortlist ?? []).length);
  const walletTotalCount = (myWalletsQ.data?.wallets ?? []).filter((w) => !w.is_archived).length;

  const setDockSettingsOpen = useDockTrackersStore((s) => s.setSettingsOpen);
  const dockOrderRaw = useDockTrackersStore((s) => s.order);
  const dockModesRaw = useDockTrackersStore((s) => s.modes);
  const dockModes = useMemo(() => normalizeDockModes(dockModesRaw), [dockModesRaw]);
  const dockBadges = useDockTrackersStore((s) => s.badges);
  const dockOrder = useMemo(() => normalizeDockOrder(dockOrderRaw), [dockOrderRaw]);
  const spotTickerChains = normalizeSpotTickerChains(
    useDockTrackersStore((s) => s.spotTickerChains),
  );
  const regionId = useShellPrefsStore((s) => s.regionId);
  const regionLabel = bottomBarRegionById(regionId).label;
  const connectionStatus = useConnectionStatus();
  const connectionLabel =
    connectionStatus === 'stable' ? 'Stable' : connectionStatus === 'degraded' ? 'Slow' : 'Offline';

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-[100] isolate shrink-0 border-t border-border-subtle bg-bg-base pb-[env(safe-area-inset-bottom,0px)] text-[11px] font-medium tabular-nums text-fg-secondary">
        <div className="flex h-[2.5rem] w-full min-w-0 items-center justify-between gap-2 overflow-visible px-2 sm:gap-3 sm:px-3">
          <div
            className={cn(
              'hidden min-w-0 items-center gap-1 overflow-x-auto sm:flex sm:flex-nowrap sm:pr-2',
              'max-w-[min(72vw,52rem)] xl:max-w-none xl:flex-1',
              '[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
              'border-r border-border-subtle',
            )}
          >
            <TradingSettingsPopover className="shrink-0 cursor-pointer rounded-md border border-accent-primary/35 bg-accent-primary/[0.08] px-2 py-[3px] text-[11px] font-semibold tabular-nums leading-none text-accent-primary transition-colors hover:bg-accent-primary/15">
              PRESET {activePresetSlot}
            </TradingSettingsPopover>
            <button
              type="button"
              onClick={() => setDockSettingsOpen(true)}
              className={cn(
                'btn-press focus-ring relative flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-md border border-white/[0.08] bg-transparent',
                'text-fg-primary transition-colors hover:bg-bg-hover/80',
              )}
              title="Dock & tracker shortcuts"
              aria-label="Open trackers settings"
            >
              <Settings className="h-4 w-4 shrink-0" strokeWidth={2} />
            </button>
            {dockOrder.map((id) => (
              <DockTrackerSlot
                key={id}
                id={id}
                mode={dockModes[id] ?? 'compact'}
                badge={Boolean(dockBadges[id])}
                activeChain={activeChain}
                barBal={barBal}
                authenticated={authenticated}
                shortlistLen={shortlistLen}
                walletTotalCount={walletTotalCount}
              />
            ))}
          </div>

          <div className="ml-auto flex h-full shrink-0 items-center gap-2 overflow-visible sm:gap-3">
            <div className="hidden items-center gap-3 lg:flex">
              <MarketLighthouseHover
                activeChain={activeChain}
                placement="above"
                triggerClassName="h-[26px] border-border-subtle bg-bg-sunken/60"
              />
              {spotTickerChains.length > 0 ? (
                <>
                  <span className="h-3.5 w-px shrink-0 bg-border-subtle" aria-hidden />
                  <BottomBarVerticalTicker rows={rows} chain={activeChain} symbols={spotTickerChains} />
                </>
              ) : null}
            </div>

            <SandboxBadge variant="bottombar" />
            <IssuesIndicator onOpenDiagnostics={() => setDiagnosticsOpen(true)} />
            <BottomBarStatusRail onOpenDiagnostics={() => setDiagnosticsOpen(true)} />
          </div>
        </div>
      </div>
      <DockTrackersSettingsModal />
      <BugReportDrawer
        open={diagnosticsOpen}
        onClose={() => setDiagnosticsOpen(false)}
        connectionStatusLabel={connectionLabel}
        regionLabel={regionLabel}
      />
    </>
  );
}

function DockTrackerSlot({
  id,
  mode,
  badge,
  activeChain,
  barBal,
  authenticated,
  shortlistLen,
  walletTotalCount,
}: {
  id: DockTrackerId;
  mode: DockTrackerMode;
  badge: boolean;
  activeChain: AppChainId;
  barBal: number | null;
  authenticated: boolean;
  shortlistLen: number;
  walletTotalCount: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const Icon = DOCK_TRACKER_ICON[id];
  const pulsePeekOpen = useTokenDockPeekStore((s) => s.pulsePeekOpen);
  const togglePulsePeek = useTokenDockPeekStore((s) => s.togglePulsePeek);
  const walletPeekOpen = useTokenDockPeekStore((s) => s.walletPeekOpen);
  const toggleWalletPeek = useTokenDockPeekStore((s) => s.toggleWalletPeek);
  const xMonitorRailOpen = usePulseTwitterRailStore((s) => s.side !== 'hidden');
  const xMonitorPeekOpen = useTokenDockPeekStore((s) => s.xMonitorPeekOpen);
  const xMonitorOpen = xMonitorRailOpen || xMonitorPeekOpen;
  const squadsRailOpen = usePulseSquadsRailStore((s) => s.side !== 'hidden');
  const squadsOpen = squadsRailOpen || isSquadsRailOpen();
  const pnlPeekOpen = usePnlTrackerStore((s) => s.open);
  const togglePnlPeek = usePnlTrackerStore((s) => s.toggleOpen);

  const onWalletTrackerPeek = () => {
    if (activeChain !== 'sol') {
      router.push('/track');
      return;
    }
    // When opening, dock to a side another panel isn't already on so it doesn't
    // spawn on top of the docked X monitor / squads / pulse.
    if (!walletPeekOpen) {
      const free = pickFreeDockSide('wallet');
      if (free) useTokenDockPeekStore.getState().setWalletDockSnap(free);
    }
    toggleWalletPeek();
  };

  const pulseActivePeek = id === 'pulse' && pulsePeekOpen;
  const walletTrackerActivePeek = id === 'social' && walletPeekOpen;
  const xMonitorActivePeek = id === 'tracker' && xMonitorOpen;
  const squadsActivePeek = id === 'squads' && squadsOpen;
  const pnlActivePeek = id === 'pnl' && pnlPeekOpen;

  /** Tonal pills, no thick light rims — closer to dense pro terminals. */
  const chipBase =
    'relative inline-flex h-[26px] max-w-[11rem] shrink-0 items-center gap-1.5 rounded-[6px] border border-transparent bg-bg-sunken/35 px-[7px] text-[11px] font-semibold leading-none tracking-tight text-white';

  const chip = cn(
    chipBase,
    'transition-colors hover:bg-bg-hover/75 active:brightness-105',
    mode === 'icon' && 'max-w-none min-w-[28px] justify-center gap-0 px-0',
  );

  const iconCls = cn('shrink-0 text-white/95', mode === 'icon' ? 'h-[15px] w-[15px]' : 'h-[14px] w-[14px]');

  const label =
    mode === 'full'
      ? dockTrackerLabel(id, 'full')
      : mode === 'compact'
        ? dockTrackerLabel(id, 'compact')
        : '';

  const dot = badge ? (
    <span
      className="pointer-events-none absolute -right-0.5 -top-[3px] z-[1] h-[5px] w-[5px] rounded-full bg-pink-500"
      aria-hidden
    />
  ) : null;

  if (id === 'wallet') {
    const dockCount = authenticated
      ? shortlistLen > 0
        ? shortlistLen
        : walletTotalCount
      : null;

    const ovalCls = cn(
      'btn-press focus-ring relative inline-flex h-[26px] shrink-0 items-center justify-center gap-0 rounded-full border border-white/[0.08] bg-bg-sunken/35 px-2 transition-colors hover:border-white/[0.12] hover:bg-bg-hover/75 active:brightness-105',
      mode === 'icon' ? 'min-w-[52px] px-2' : 'max-w-[11rem] px-2.5',
      authenticated ? '' : 'opacity-95',
    );

    return (
      <span className="relative inline-flex shrink-0">
        {dot}
        <WalletPickerPopover className={ovalCls}>
          {mode === 'icon' ? (
            <span className="inline-flex items-center gap-1">
              <Wallet className={iconCls} strokeWidth={2} aria-hidden />
              <ChevronDown className="h-3 w-3 shrink-0 text-white/45" strokeWidth={2.25} aria-hidden />
            </span>
          ) : (
            <TerminalWalletChip
              walletCount={dockCount}
              nativeBalance={authenticated ? barBal : 0}
              activeChain={activeChain}
              variant="dock"
              showChevron
            />
          )}
        </WalletPickerPopover>
      </span>
    );
  }

  if (id === 'social') {
    return (
      <button
        type="button"
        className={cn(
          chip,
          walletTrackerActivePeek && 'ring-1 ring-accent-primary/40 bg-accent-primary/[0.1]',
        )}
        title={dockTrackerLabel(id, 'full')}
        aria-label={
          walletPeekOpen ? 'Close wallet tracker' : 'Open draggable wallet tracker'
        }
        onClick={onWalletTrackerPeek}
      >
        {dot}
        <Icon className={iconCls} strokeWidth={2} aria-hidden />
        {mode !== 'icon' ? (
          <span className="max-w-[7rem] truncate leading-none text-white/95 2xl:max-w-[8rem]">{label}</span>
        ) : null}
      </button>
    );
  }

  if (id === 'tracker') {
    return (
      <button
        type="button"
        className={cn(
          chip,
          xMonitorActivePeek && 'ring-1 ring-accent-primary/40 bg-accent-primary/[0.1]',
        )}
        title={dockTrackerLabel(id, 'full')}
        aria-label={xMonitorOpen ? 'Close X monitor' : 'Open X monitor on Pulse'}
        onClick={() => {
          if (activeChain !== 'sol') {
            openXMonitorOnPulse('left');
            return;
          }
          toggleXMonitorOnPulse('left');
        }}
      >
        {dot}
        <Icon className={iconCls} strokeWidth={2} aria-hidden />
        {mode !== 'icon' ? (
          <span className="max-w-[7rem] truncate leading-none text-white/95 2xl:max-w-[8rem]">{label}</span>
        ) : null}
      </button>
    );
  }

  if (id === 'pnl') {
    return (
      <button
        type="button"
        className={cn(chip, pnlActivePeek && 'ring-1 ring-accent-primary/40 bg-accent-primary/[0.1]')}
        title={dockTrackerLabel(id, 'full')}
        aria-label={pnlPeekOpen ? 'Close PnL tracker' : 'Open draggable PnL tracker'}
        onClick={() => {
          if (activeChain !== 'sol') {
            router.push('/portfolio');
            return;
          }
          togglePnlPeek();
        }}
      >
        {dot}
        <Icon className={iconCls} strokeWidth={2} aria-hidden />
        {mode !== 'icon' ? (
          <span className="max-w-[7rem] truncate leading-none text-white/95 2xl:max-w-[8rem]">{label}</span>
        ) : null}
      </button>
    );
  }

  if (id === 'pulse') {
    const onPulseRoute = pathname?.startsWith('/pulse') ?? false;
    return (
      <button
        type="button"
        className={cn(chip, pulseActivePeek && 'bg-accent-primary/[0.14]')}
        title={dockTrackerLabel(id, 'full')}
        aria-label={
          onPulseRoute
            ? dockTrackerLabel(id, 'full')
            : pulsePeekOpen
              ? 'Close Pulse popup'
              : 'Open draggable Pulse popup'
        }
        onClick={() => {
          if (onPulseRoute) return;
          if (activeChain !== 'sol') {
            router.push('/pulse');
            return;
          }
          togglePulsePeek();
        }}
      >
        {dot}
        <Icon className={iconCls} strokeWidth={2} aria-hidden />
        {mode !== 'icon' ? (
          <span className="max-w-[7rem] truncate leading-none text-white/95 2xl:max-w-[8rem]">{label}</span>
        ) : null}
      </button>
    );
  }

  if (id === 'squads') {
    return (
      <button
        type="button"
        className={cn(
          chip,
          squadsActivePeek && 'ring-1 ring-accent-primary/40 bg-accent-primary/[0.12]',
        )}
        title={dockTrackerLabel(id, 'full')}
        aria-label={squadsOpen ? 'Close squads panel' : 'Open squads panel on Pulse'}
        onClick={() => toggleSquadsOnPulse()}
      >
        {dot}
        <Icon className={iconCls} strokeWidth={2} aria-hidden />
        {mode !== 'icon' ? (
          <span className="max-w-[7rem] truncate leading-none text-white/95 2xl:max-w-[8rem]">{label}</span>
        ) : null}
      </button>
    );
  }

  const slug = id as keyof typeof DOCK_TRACKER_HREF;

  return (
    <Link href={DOCK_TRACKER_HREF[slug]} className={chip} title={dockTrackerLabel(id, 'full')}>
      {dot}
      <Icon className={iconCls} strokeWidth={2} aria-hidden />
      {mode !== 'icon' ? (
        <span className="max-w-[7rem] truncate leading-none text-white/95 2xl:max-w-[8rem]">{label}</span>
      ) : null}
    </Link>
  );
}
