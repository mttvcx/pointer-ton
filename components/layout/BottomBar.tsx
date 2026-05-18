'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertCircle,
  ChevronDown,
  Globe,
  Headphones,
  Settings,
  Wallet,
  X,
} from 'lucide-react';
import { DiagnosticsTriggerButton, BugReportDrawer } from '@/components/reports/BugReportDrawer';
import { snapshotRecentClientErrors } from '@/lib/reports/clientErrorRing';
import { cn } from '@/lib/utils/cn';
import type { MyWalletRow } from '@/lib/hooks/useActiveSolanaWallet';
import { useDockTrackerHotkeys } from '@/lib/hooks/useDockTrackerHotkeys';
import { CHAIN_ICON_PNG } from '@/lib/chains/chainAssets';
import { useActiveSolanaWallet } from '@/lib/hooks/useActiveSolanaWallet';
import { formatNumber, parseLamportsStringToSol } from '@/lib/utils/formatters';
import { mintMatchesAppChain } from '@/lib/chains/mintKind';
import { nativeTicker } from '@/lib/chains/nativeCurrency';
import type { DockTrackerId, DockTrackerMode } from '@/lib/dock/dockTrackerConfig';
import {
  DOCK_TRACKER_HREF,
  dockTrackerLabel,
  WALLET_HOTKEY_ROUTE,
} from '@/lib/dock/dockTrackerConfig';
import { useUIStore } from '@/store/ui';
import { useTradingStore } from '@/store/trading';
import type { AppChainId } from '@/lib/chains/appChain';
import { WalletPickerPopover } from '@/components/wallets/WalletPickerPopover';
import { TradingSettingsPopover } from '@/components/trading/TradingSettingsPopover';
import { DockTrackersSettingsModal } from '@/components/layout/DockTrackersSettingsModal';
import { DOCK_TRACKER_ICON } from '@/components/layout/dockTrackerUi';
import type { DockSpotTickerMode } from '@/store/dockTrackers';
import { normalizeDockModes, normalizeDockOrder, useDockTrackersStore } from '@/store/dockTrackers';
import { useTokenDockPeekStore } from '@/store/tokenDockPeek';

type TickerRow = { symbol: string; usdPrice: number | null; priceChange24h: number | null };

/** Carousel slide height in px — viewport and transform must match exactly. */
const TICKER_LINE_PX = 28;

const SPOT_SYM_CLASS: Partial<Record<string, string>> = {
  BTC: 'bg-amber-400',
  ETH: 'bg-blue-400',
  SOL: 'bg-emerald-400',
  TON: 'bg-sky-400',
};
function rotatingCenterSymbols(chain: AppChainId): string[] {
  return ['BTC', 'ETH', nativeTicker(chain)];
}

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
      <span className="font-semibold uppercase tracking-wide text-white">{row.symbol}</span>
      <span className="tabular-nums text-white">{price}</span>
      <span
        className={cn(
          'tabular-nums transition-colors duration-150',
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
  mode,
}: {
  rows: TickerRow[];
  chain: AppChainId;
  mode: DockSpotTickerMode;
}) {
  const order = rotatingCenterSymbols(chain);
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

  const dupFirst = resolved[0] ?? {
    symbol: order[0] ?? 'BTC',
    usdPrice: null,
    priceChange24h: null,
  };
  const slides: TickerRow[] = [...resolved, dupFirst];

  if (mode === 'icons') {
    return (
      <div className="flex shrink-0 items-center gap-1.5 px-0.5" aria-label="Spot prices">
        {resolved.map((row) => (
          <span
            key={row.symbol}
            title={`${row.symbol} spot`}
            className={cn(
              'pointer-events-none h-5 min-w-[20px] rounded-full px-2 text-center text-[8px] font-bold leading-[20px] text-bg-base shadow-sm',
              SPOT_SYM_CLASS[row.symbol] ?? 'bg-fg-muted',
            )}
          >
            {row.symbol.slice(0, 3)}
          </span>
        ))}
      </div>
    );
  }

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

  return (
    <div
      className="w-[260px] max-w-[42vw] overflow-hidden"
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
            className="flex shrink-0 items-center gap-2 whitespace-nowrap text-[12px] font-medium tabular-nums leading-none pointer-events-none"
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

  // Hidden in production: end users don't need a live error counter; they have
  // the silent diagnostics drawer (DiagnosticsTriggerButton) if they want to
  // report something. Dev keeps the counter so engineers see issues in their
  // sessions. Mirrors the comment in next.config.ts about chrome consistency.
  if (process.env.NODE_ENV === 'production') return null;
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
  const { activePresetSlot } = useTradingStore();
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

  const { activeAddress, ready: walletsReady } = useActiveSolanaWallet(
    myWalletsQ.data?.wallets,
  );

  const tickersQ = useQuery({
    queryKey: ['jupiter-tickers'],
    queryFn: async (): Promise<TickerRow[]> => {
      const res = await fetch('/api/prices/tickers');
      const json: unknown = await res.json();
      const arr =
        json && typeof json === 'object' && 'tickers' in json
          ? (json as { tickers: TickerRow[] }).tickers
          : [];
      return Array.isArray(arr) ? arr : [];
    },
    refetchInterval: 30_000,
    staleTime: 25_000,
  });

  const portfolioQ = useQuery({
    queryKey: ['portfolio', activeAddress],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      const q = activeAddress ? `?wallet=${encodeURIComponent(activeAddress)}` : '';
      const res = await fetch(`/api/portfolio${q}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('portfolio');
      return res.json() as Promise<{ solLamports: string | null }>;
    },
    enabled: Boolean(
      authenticated &&
        walletsReady &&
        activeAddress &&
        activeChain === 'sol' &&
        mintMatchesAppChain(activeAddress, 'sol'),
    ),
    staleTime: 20_000,
  });

  const rows = tickersQ.data ?? [];

  const solBal = parseLamportsStringToSol(portfolioQ.data?.solLamports);

  const rowForActive = myWalletsQ.data?.wallets?.find((w) => w.wallet_address === activeAddress);
  const tonBalUi =
    activeChain === 'ton'
      ? parseLamportsStringToSol(rowForActive?.balance_lamports ?? null) ?? 0
      : null;

  const barBal =
    activeChain === 'sol' ? solBal : activeChain === 'ton' ? tonBalUi : null;

  const shortlistLen = useTradingStore((s) => s.instantTradeWalletShortlist.length);

  const setDockSettingsOpen = useDockTrackersStore((s) => s.setSettingsOpen);
  const dockOrderRaw = useDockTrackersStore((s) => s.order);
  const dockModesRaw = useDockTrackersStore((s) => s.modes);
  const dockModes = useMemo(() => normalizeDockModes(dockModesRaw), [dockModesRaw]);
  const dockBadges = useDockTrackersStore((s) => s.badges);
  const dockOrder = useMemo(() => normalizeDockOrder(dockOrderRaw), [dockOrderRaw]);
  const spotTickerMode = useDockTrackersStore((s) => s.spotTickerMode);

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-50 flex min-h-[2.5rem] shrink-0 border-t border-white/[0.06] bg-bg-base pb-[env(safe-area-inset-bottom,0px)] text-[11px] font-medium tabular-nums text-fg-secondary">
      <div className="flex min-h-[2.5rem] w-full min-w-0 items-center gap-1.5 overflow-x-auto px-2 sm:gap-2 sm:px-2.5">
        <div className="hidden min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 border-r border-white/[0.06] pr-2 sm:flex">
          <TradingSettingsPopover className="cursor-pointer rounded-md border border-accent-primary/35 bg-accent-primary/[0.08] px-2 py-[3px] text-[11px] font-semibold tabular-nums leading-none text-accent-primary transition-colors hover:bg-accent-primary/15">
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
            />
          ))}
        </div>

        <div className="hidden min-w-0 flex-1 sm:block" aria-hidden />

        <div className="hidden shrink-0 items-center gap-2 sm:flex">
          {tickersQ.isLoading && !tickersQ.data ? (
            <span className="text-fg-secondary">Prices...</span>
          ) : null}
          <BottomBarVerticalTicker rows={rows} chain={activeChain} mode={spotTickerMode} />
        </div>

        <div className="min-w-0 flex-1" aria-hidden />

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <IssuesIndicator onOpenDiagnostics={() => setDiagnosticsOpen(true)} />
          <span className="hidden items-center gap-1 rounded-full border border-signal-bull/35 bg-signal-bull/10 px-2 py-0.5 text-[10px] font-semibold tracking-tight text-signal-bull md:inline-flex">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-signal-bull" />
            Stable
          </span>
          <span className="hidden text-[10px] font-semibold tracking-wide text-fg-secondary lg:inline">US-E</span>
          <DiagnosticsTriggerButton compactMobile onClick={() => setDiagnosticsOpen(true)} />
          <button type="button" className="rounded p-1.5 text-fg-secondary transition-colors hover:bg-bg-hover/80 hover:text-fg-primary" title="Help">
            <Globe className="h-4 w-4" strokeWidth={2} />
          </button>
          <button type="button" className="rounded p-1.5 text-fg-secondary transition-colors hover:bg-bg-hover/80 hover:text-fg-primary" title="Support">
            <Headphones className="h-4 w-4" strokeWidth={2} />
          </button>
          <button type="button" className="rounded p-1.5 text-fg-secondary transition-colors hover:bg-bg-hover/80 hover:text-fg-primary" title="Activity">
            <Activity className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
      <DockTrackersSettingsModal />
      <BugReportDrawer
        open={diagnosticsOpen}
        onClose={() => setDiagnosticsOpen(false)}
        connectionStatusLabel="Stable"
        regionLabel="US-E"
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
}: {
  id: DockTrackerId;
  mode: DockTrackerMode;
  badge: boolean;
  activeChain: AppChainId;
  barBal: number | null;
  authenticated: boolean;
  shortlistLen: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const Icon = DOCK_TRACKER_ICON[id];
  const pulsePeekOpen = useTokenDockPeekStore((s) => s.pulsePeekOpen);
  const togglePulsePeek = useTokenDockPeekStore((s) => s.togglePulsePeek);
  const walletPeekOpen = useTokenDockPeekStore((s) => s.walletPeekOpen);
  const toggleWalletPeek = useTokenDockPeekStore((s) => s.toggleWalletPeek);

  /** Tonal pills, no thick light rims — closer to dense pro terminals. */
  const chipBase =
    'relative inline-flex h-[26px] max-w-[11rem] shrink-0 items-center gap-1.5 rounded-[6px] border border-transparent bg-bg-sunken/35 px-[7px] text-[11px] font-semibold leading-none tracking-tight text-white';

  const chip = cn(
    chipBase,
    'transition-colors hover:bg-bg-hover/75 active:brightness-105',
    mode === 'icon' && 'max-w-none min-w-[28px] justify-center gap-0 px-0',
  );

  const iconCls = cn('shrink-0 text-white/95', mode === 'icon' ? 'h-[15px] w-[15px]' : 'h-[14px] w-[14px]');

  const pulseActivePeek = id === 'pulse' && pulsePeekOpen;
  const walletActivePeek = id === 'wallet' && walletPeekOpen;

  const onWalletTrackerPeek = () => {
    if (activeChain !== 'sol') {
      router.push(WALLET_HOTKEY_ROUTE);
      return;
    }
    toggleWalletPeek();
  };

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

  if (id === 'wallet' && mode === 'icon') {
    const splitOuter = cn(
      'relative',
      chipBase,
      'inline-flex shrink-0 gap-0 overflow-hidden p-0 transition-colors hover:bg-bg-hover/75 active:brightness-105',
      'max-w-none min-w-[54px]',
      walletActivePeek && 'ring-1 ring-accent-primary/40 bg-accent-primary/[0.1]',
      authenticated ? '' : 'opacity-95',
    );

    const pickerRail =
      'btn-press relative flex h-[26px] w-[26px] shrink-0 items-center justify-center border-l border-white/[0.08] bg-transparent text-white/85 hover:bg-bg-hover/80 hover:text-white';

    return (
      <span className={splitOuter}>
        {dot}
        <button
          type="button"
          title={dockTrackerLabel(id, 'full')}
          aria-label={
            walletPeekOpen ? `${dockTrackerLabel(id, 'full')} — close popup` : `Open ${dockTrackerLabel(id, 'full')} popup`
          }
          className="btn-press flex h-[26px] min-w-0 flex-1 items-center justify-center px-1.5"
          onClick={onWalletTrackerPeek}
        >
          <Wallet className={iconCls} strokeWidth={2} aria-hidden />
        </button>
        <WalletPickerPopover className={pickerRail}>
          <span aria-label="Open instant-trade wallet picker">
            <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-85" strokeWidth={2.5} aria-hidden />
          </span>
        </WalletPickerPopover>
      </span>
    );
  }

  if (id === 'wallet') {
    const splitOuter = cn(
      chipBase,
      'relative inline-flex min-w-0 max-w-[10.75rem] gap-0 overflow-hidden p-0 transition-colors hover:bg-bg-hover/75 active:brightness-105',
      walletActivePeek && 'ring-1 ring-accent-primary/40 bg-accent-primary/[0.1]',
      authenticated ? '' : 'opacity-95',
    );

    const pickerRail =
      'btn-press relative flex h-[26px] w-[29px] shrink-0 items-center justify-center border-l border-white/[0.08] bg-transparent text-white/85 hover:bg-bg-hover/85 hover:text-white';

    return (
      <span className={splitOuter}>
        {dot}
        <button
          type="button"
          title={dockTrackerLabel(id, 'full')}
          aria-label={
            walletPeekOpen ? `${dockTrackerLabel(id, 'full')} — close popup` : `Open ${dockTrackerLabel(id, 'full')} popup`
          }
          className="btn-press flex h-[26px] min-w-0 flex-1 items-center gap-1 pl-[7px] pr-1 text-left"
          onClick={onWalletTrackerPeek}
        >
          <Wallet className={iconCls} strokeWidth={2} aria-hidden />
          <span className="shrink-0 tabular-nums leading-none text-white/95">
            {authenticated ? String(Math.max(0, shortlistLen || 0)) : '–'}
          </span>
          <img
            src={CHAIN_ICON_PNG[activeChain]}
            alt=""
            width={14}
            height={14}
            draggable={false}
            className="h-[14px] w-[14px] shrink-0 rounded-[4px] object-contain opacity-95"
          />
          <span className="min-w-0 flex-1 truncate font-semibold tabular-nums leading-none tracking-tight text-white/95">
            {authenticated && barBal != null ? formatNumber(barBal, { decimals: 4 }) : '0'}
          </span>
        </button>
        <WalletPickerPopover className={pickerRail}>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-85" strokeWidth={2.5} aria-hidden />
        </WalletPickerPopover>
      </span>
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

  const slug = id as Exclude<DockTrackerId, 'wallet'>;

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
