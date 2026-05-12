'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { useEffect, useState } from 'react';
import {
  Activity,
  AlertCircle,
  CircleDollarSign,
  Compass,
  Globe,
  Headphones,
  Radar,
  Sparkles,
  Wallet,
  X,
} from 'lucide-react';
import { DiagnosticsTriggerButton, BugReportDrawer } from '@/components/reports/BugReportDrawer';
import { snapshotRecentClientErrors } from '@/lib/reports/clientErrorRing';
import { cn } from '@/lib/utils/cn';
import type { MyWalletRow } from '@/lib/hooks/useActiveSolanaWallet';
import { useActiveSolanaWallet } from '@/lib/hooks/useActiveSolanaWallet';
import { formatNumber, parseLamportsStringToSol } from '@/lib/utils/formatters';
import { mintMatchesAppChain } from '@/lib/chains/mintKind';
import { nativeTicker } from '@/lib/chains/nativeCurrency';
import { useUIStore } from '@/store/ui';
import { useTradingStore } from '@/store/trading';
import type { AppChainId } from '@/lib/chains/appChain';

type PresetRow = { slot: 1 | 2 | 3; name: string };

type TickerRow = { symbol: string; usdPrice: number | null; priceChange24h: number | null };

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
      <span className="font-semibold uppercase tracking-wide text-fg-muted">{row.symbol}</span>
      <span className="tabular-nums text-fg-primary">{price}</span>
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

function BottomBarVerticalTicker({ rows, chain }: { rows: TickerRow[]; chain: AppChainId }) {
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

  return (
    <div
      className="pointer-events-none h-5 w-[240px] max-w-[40vw] overflow-hidden"
      aria-live="polite"
      aria-label="Spot prices"
    >
      <div className="flex flex-col animate-bottom-bar-ticker will-change-transform">
        {slides.map((row, i) => (
          <div
            key={`${row.symbol}-${i}`}
            className="flex h-5 shrink-0 items-center justify-center gap-2 whitespace-nowrap text-[11px] tabular-nums"
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
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const { getAccessToken, authenticated } = usePointerAuth();
  const { activePresetSlot } = useTradingStore();
  const activeChain = useUIStore((s) => s.activeChain);
  const nativeSym = nativeTicker(activeChain);

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

  const presetsQ = useQuery({
    queryKey: ['trading-presets'],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) return { presets: [] as PresetRow[] };
      const res = await fetch('/api/presets', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return { presets: [] as PresetRow[] };
      return res.json() as Promise<{ presets: PresetRow[] }>;
    },
    enabled: authenticated,
    staleTime: 60_000,
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

  const pnlQ = useQuery({
    queryKey: ['pnl-today'],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      const res = await fetch('/api/me/pnl-today', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('pnl');
      return res.json() as Promise<{ pnlSolToday: number }>;
    },
    enabled: authenticated && activeChain === 'sol',
    staleTime: 45_000,
  });

  const volQ = useQuery({
    queryKey: ['platform-volume'],
    queryFn: async () => {
      const res = await fetch('/api/stats/platform-volume');
      const json = (await res.json()) as { volumeSolToday?: number };
      return json.volumeSolToday ?? 0;
    },
    enabled: activeChain === 'sol',
    refetchInterval: 60_000,
    staleTime: 55_000,
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

  const presetName =
    presetsQ.data?.presets?.find((p) => p.slot === activePresetSlot)?.name ?? `S${activePresetSlot}`;

  return (
    <>
      <div
        className="fixed bottom-0 left-0 right-0 z-50 flex min-h-11 shrink-0 border-t pb-[env(safe-area-inset-bottom,0px)] text-[10px] tabular-nums text-[#9ca3af]"
        style={{ borderColor: '#1b1f2a', backgroundColor: '#080d14' }}
      >
      <div className="flex min-h-11 w-full min-w-0 items-center gap-2 overflow-x-auto px-2 sm:gap-2 sm:px-2.5">
        <div className="hidden min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 border-r pr-2 sm:flex" style={{ borderColor: '#1b1f2a' }}>
          <span className="rounded border px-1 py-px text-[9px] tabular-nums font-semibold text-[#5eead4]" style={{ borderColor: '#1b1f2a' }}>
            PRESET {activePresetSlot}
          </span>
          <DockLink href="/wallets" icon={Wallet} label="Wallet" />
          <DockLink href="/pulse" icon={Compass} label="Discover" />
          <DockLink href="/track" icon={Radar} label="Track" />
          <DockLink href="/portfolio" icon={CircleDollarSign} label="PnL" />
          <DockLink href="/points" icon={Sparkles} label="Alpha" />
        </div>

        <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-x-2 gap-y-0.5 sm:gap-x-3 sm:flex-wrap">
          {tickersQ.isLoading && !tickersQ.data ? (
            <span className="text-fg-muted">Prices...</span>
          ) : null}
          <span className="text-fg-muted">
            Bal{' '}
            <span className="tabular-nums text-fg-primary">
              {barBal != null ? `${formatNumber(barBal, { decimals: 3 })} ${nativeSym}` : `0.000 ${nativeSym}`}
            </span>
          </span>
          <span className="text-fg-muted">
            Vol{' '}
            <span className="tabular-nums text-fg-primary">
              {activeChain === 'sol'
                ? `${formatNumber(volQ.data ?? 0, { decimals: 1, compact: true })} ${nativeSym}`
                : '\u2014'}
            </span>
          </span>
          <span className="text-fg-muted">
            Today{' '}
            <span
              className={cn(
                'tabular-nums',
                activeChain === 'sol' && (pnlQ.data?.pnlSolToday ?? 0) > 0
                  ? 'text-signal-bull'
                  : activeChain === 'sol' && (pnlQ.data?.pnlSolToday ?? 0) < 0
                    ? 'text-signal-bear'
                    : 'text-fg-primary',
              )}
            >
              {activeChain === 'sol' && pnlQ.data
                ? `${formatNumber(pnlQ.data.pnlSolToday, { decimals: 3 })} ${nativeSym}`
                : '\u2014'}
            </span>
          </span>
          {authenticated ? (
            <span className="max-w-[100px] truncate text-fg-muted" title={presetName}>
              {presetName}
            </span>
          ) : null}
        </div>

        <div className="hidden shrink-0 justify-center sm:flex">
          <BottomBarVerticalTicker rows={rows} chain={activeChain} />
        </div>

        <div className="min-w-0 flex-1" aria-hidden />

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <IssuesIndicator onOpenDiagnostics={() => setDiagnosticsOpen(true)} />
          <span className="hidden items-center gap-0.5 rounded-full border border-emerald-500/35 bg-emerald-500/10 px-1.5 py-px text-[9px] font-semibold text-emerald-300 md:inline-flex">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            Stable
          </span>
          <span className="hidden text-[9px] font-semibold text-[#4b5563] lg:inline">US-E</span>
          <DiagnosticsTriggerButton compactMobile onClick={() => setDiagnosticsOpen(true)} />
          <button type="button" className="rounded p-1 text-[#4b5563] hover:bg-white/5 hover:text-[#9ca3af]" title="Help">
            <Globe className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
          <button type="button" className="rounded p-1 text-[#4b5563] hover:bg-white/5 hover:text-[#9ca3af]" title="Support">
            <Headphones className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
          <button type="button" className="rounded p-1 text-[#4b5563] hover:bg-white/5 hover:text-[#9ca3af]" title="Activity">
            <Activity className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
      <BugReportDrawer
        open={diagnosticsOpen}
        onClose={() => setDiagnosticsOpen(false)}
        connectionStatusLabel="Stable"
        regionLabel="US-E"
      />
    </>
  );
}

function DockLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: typeof Wallet;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-medium text-[#6b7280] transition hover:bg-white/[0.06] hover:text-[#e5e7eb]"
    >
      <Icon className="h-3 w-3 shrink-0 opacity-90" strokeWidth={2} />
      <span className="hidden xl:inline">{label}</span>
    </Link>
  );
}
