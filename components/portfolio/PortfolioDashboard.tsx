'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { useCreateWallet } from '@/lib/auth/solanaShims';
import {
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  EyeOff,
  Loader2,
  Search,
  Wallet,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import type { MyWalletRow } from '@/lib/hooks/useActiveSolanaWallet';
import { useActiveSolanaWallet } from '@/lib/hooks/useActiveSolanaWallet';
import { ImportWalletModal } from '@/components/wallets/ImportWalletModal';
import { TrackersPanel } from '@/components/trackers/TrackersPanel';
import { explorerAccountUrlForChain } from '@/lib/chains/explorer';
import { explorerUrlSolanaTx } from '@/lib/chains/explorerUrls';
import { shortenAddress } from '@/lib/utils/addresses';
import { cn } from '@/lib/utils/cn';
import { useUIStore } from '@/store/ui';
import { useWalletIntelStore } from '@/store/walletIntelStore';
import { mintMatchesAppChain } from '@/lib/chains/mintKind';
import { nativeTicker } from '@/lib/chains/nativeCurrency';
import { xLiveSearchContractUrl } from '@/lib/utils/xSearch';
import {
  formatCompactUsd,
  formatNumber,
  formatRelativeTime,
  formatUsd,
  lamportsToSol,
} from '@/lib/utils/formatters';
import { useOverlayPresence } from '@/lib/hooks/useOverlayPresence';
import { overlayBackdropClasses, overlayPanelClasses } from '@/lib/ui/overlayMotion';
import {
  CapitalFlowArrow,
  CapitalFunderPicker,
  OS,
  PortfolioWalletSelector,
  WalletMonogram,
  WalletTableRowShell,
} from '@/components/portfolio/walletOs';

type PositionRow = {
  mint: string;
  balanceRaw: string;
  decimals: number;
  symbol: string | null;
  imageUrl: string | null;
  costBasisSol: number;
  costBasisUsd: number;
  valueUsd: number | null;
  unrealizedPnlUsd: number | null;
  avgEntrySolPerUiToken: number | null;
};

type ClosedSellRow = {
  tradeId: string;
  mint: string;
  submittedAt: string;
  txSignature: string;
  amountTokenRaw: string;
  solProceeds: number;
  costBasisSol: number;
  realizedPnlUsd: number;
  symbol: string | null;
  decimals: number;
};

type TradeRowApi = {
  id: string;
  mint: string;
  side: 'buy' | 'sell';
  status: string;
  amountSol: number | null;
  txSignature: string;
  submittedAt: string;
};

type PortfolioJson = {
  walletAddress: string | null;
  solLamports: string | null;
  holdings: Array<{
    mint: string;
    rawAmount: string;
    symbol: string | null;
    decimals: number;
    imageUrl: string | null;
  }>;
  solUsd: number | null;
  summary: {
    totalValueUsd: number | null;
    realizedPnlUsd: number;
    unrealizedPnlUsd: number;
    totalPnlUsd: number;
  };
  positions: PositionRow[];
  closedSells: ClosedSellRow[];
  trades: TradeRowApi[];
};

type PortfolioTab = 'spot' | 'wallets' | 'trackers';
type SpotTableTab = 'active_positions' | 'history' | 'top100';
type TimeFilter = '1d' | '7d' | '30d' | 'max';
type PortfolioWalletSelection = 'all' | string;
type TickerRow = { symbol: string; usdPrice: number | null; priceChange24h: number | null };

const PANEL = '#121622';
const PANEL2 = '#151826';
const BORDER = '#1b1f2a';
const EMPTY_POSITIONS: PositionRow[] = [];
const EMPTY_CLOSED_SELLS: ClosedSellRow[] = [];
const EMPTY_TRADES: TradeRowApi[] = [];
const EMPTY_PORTFOLIO: PortfolioJson = {
  walletAddress: null,
  solLamports: null,
  holdings: [],
  solUsd: null,
  summary: {
    totalValueUsd: null,
    realizedPnlUsd: 0,
    unrealizedPnlUsd: 0,
    totalPnlUsd: 0,
  },
  positions: [],
  closedSells: [],
  trades: [],
};

async function authJson<T>(
  token: string,
  url: string,
  init?: RequestInit,
): Promise<{ ok: true; data: T } | { ok: false; status: number; message: string }> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  const json: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      json && typeof json === 'object' && 'message' in json
        ? String((json as { message: unknown }).message)
        : json && typeof json === 'object' && 'error' in json
          ? String((json as { error: unknown }).error)
          : res.statusText;
    return { ok: false, status: res.status, message };
  }
  return { ok: true, data: json as T };
}

/** Safe UI conversion — malformed API values must not crash the dashboard. */
function balanceLamportsToSol(raw: string | null | undefined): number {
  if (raw == null) return 0;
  const s = String(raw).trim();
  if (!s || !/^\d+$/.test(s)) return 0;
  try {
    return lamportsToSol(BigInt(s));
  } catch {
    return 0;
  }
}

export function PortfolioDashboard({
  className,
  initialTab,
  prefillTrackerWallet,
}: {
  className?: string;
  initialTab?: PortfolioTab;
  prefillTrackerWallet?: string;
}) {
  const { authenticated, getAccessToken } = usePointerAuth();
  const activeChain = useUIStore((s) => s.activeChain);
  const openWalletIntel = useWalletIntelStore((s) => s.openWallet);
  const qc = useQueryClient();
  const { createWallet } = useCreateWallet();
  const [tab, setTab] = useState<PortfolioTab>(initialTab ?? 'spot');
  const [spotTableTab, setSpotTableTab] = useState<SpotTableTab>('active_positions');
  const [selectedPortfolioWalletId, setSelectedPortfolioWalletId] =
    useState<PortfolioWalletSelection>('all');
  const [walletSelectorOpen, setWalletSelectorOpen] = useState(false);
  const [walletSelectorSearch, setWalletSelectorSearch] = useState('');
  const [searchWallets, setSearchWallets] = useState('');
  const [searchTable, setSearchTable] = useState('');
  const [showHidden, setShowHidden] = useState(false);
  const [usdMode, setUsdMode] = useState(true);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('30d');
  const [funderWalletId, setFunderWalletId] = useState<string | null>(null);
  const [receiverWalletIds, setReceiverWalletIds] = useState<string[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferAmount, setTransferAmount] = useState('');
  const [funderPickerOpen, setFunderPickerOpen] = useState(false);
  const walletSelectorRef = useRef<HTMLDivElement>(null);
  const funderPickerRef = useRef<HTMLDivElement>(null);

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

  const { ready: walletsReady, activeAddress: activeTradingAddress } = useActiveSolanaWallet(myWalletsQ.data?.wallets);

  const allWallets = useMemo(() => myWalletsQ.data?.wallets ?? [], [myWalletsQ.data?.wallets]);
  const chainWallets = useMemo(
    () => allWallets.filter((w) => mintMatchesAppChain(w.wallet_address, activeChain)),
    [allWallets, activeChain],
  );
  const visibleWallets = useMemo(
    () => chainWallets.filter((w) => showHidden || !w.is_archived),
    [chainWallets, showHidden],
  );
  const selectedPortfolioWallet =
    selectedPortfolioWalletId === 'all'
      ? null
      : chainWallets.find((w) => w.id === selectedPortfolioWalletId) ?? null;
  const selectedWalletMissing =
    selectedPortfolioWalletId !== 'all' && !selectedPortfolioWallet;
  const selectedWalletAddress =
    selectedPortfolioWalletId === 'all' ? null : selectedPortfolioWallet?.wallet_address ?? null;
  const nativeSym = nativeTicker(activeChain);
  const combinedNativeUi = useMemo(
    () => visibleWallets.reduce((sum, w) => sum + balanceLamportsToSol(w.balance_lamports), 0),
    [visibleWallets],
  );

  /** Specific wallet chosen but `/api/wallets/my` hasn't returned yet — avoid false "missing" and BigInt work on empty rows. */
  const awaitingWalletListForSelection =
    selectedPortfolioWalletId !== 'all' && myWalletsQ.isPending && myWalletsQ.data === undefined;

  useEffect(() => {
    if (selectedPortfolioWalletId === 'all') return;
    if (chainWallets.some((w) => w.id === selectedPortfolioWalletId)) return;
    queueMicrotask(() => setSelectedPortfolioWalletId('all'));
  }, [activeChain, chainWallets, selectedPortfolioWalletId]);

  useEffect(() => {
    if (!walletSelectorOpen) return;
    function onPointerDown(e: MouseEvent) {
      if (walletSelectorRef.current?.contains(e.target as Node)) return;
      setWalletSelectorOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setWalletSelectorOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [walletSelectorOpen]);

  useEffect(() => {
    if (!funderPickerOpen) return;
    function onPointerDown(e: MouseEvent) {
      if (funderPickerRef.current?.contains(e.target as Node)) return;
      setFunderPickerOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setFunderPickerOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [funderPickerOpen]);

  const portfolioEnabled =
    authenticated &&
    walletsReady &&
    activeChain === 'sol' &&
    (selectedPortfolioWalletId === 'all' ||
      Boolean(selectedWalletAddress && mintMatchesAppChain(selectedWalletAddress, 'sol')));

  const query = useQuery({
    queryKey: ['portfolio', activeChain, selectedPortfolioWalletId, selectedWalletAddress, timeFilter],
    enabled: portfolioEnabled,
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      const base = '/api/portfolio?tradesLimit=80&fifoLimit=3000';
      const url = selectedWalletAddress
        ? `${base}&wallet=${encodeURIComponent(selectedWalletAddress)}`
        : base;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json: unknown = await res.json();
      if (!res.ok) {
        throw new Error(
          typeof json === 'object' && json && 'message' in json
            ? String((json as { message: unknown }).message)
            : 'portfolio failed',
        );
      }
      return json as PortfolioJson;
    },
  });

  const tickersQ = useQuery({
    queryKey: ['portfolio-page-tickers'],
    queryFn: async (): Promise<TickerRow[]> => {
      const res = await fetch('/api/prices/tickers');
      const j = (await res.json()) as { tickers?: TickerRow[] };
      return j.tickers ?? [];
    },
    staleTime: 30_000,
  });

  const walletRows = useMemo(() => {
    const q = searchWallets.trim().toLowerCase();
    return visibleWallets.filter((w) => {
      if (!q) return true;
      return (
        w.wallet_address.toLowerCase().includes(q) ||
        (w.label ?? '').toLowerCase().includes(q)
      );
    });
  }, [visibleWallets, searchWallets]);
  const selectorWallets = useMemo(() => {
    const q = walletSelectorSearch.trim().toLowerCase();
    if (!q) return visibleWallets;
    return visibleWallets.filter(
      (w) =>
        w.wallet_address.toLowerCase().includes(q) ||
        (w.label ?? '').toLowerCase().includes(q),
    );
  }, [visibleWallets, walletSelectorSearch]);
  const funderWallet = visibleWallets.find((w) => w.id === funderWalletId) ?? null;
  const receiverWallets = receiverWalletIds
    .map((id) => visibleWallets.find((w) => w.id === id))
    .filter((w): w is MyWalletRow => Boolean(w));
  const receiverIdSet = useMemo(() => new Set(receiverWalletIds), [receiverWalletIds]);
  const transferSheetOpen =
    transferOpen && Boolean(funderWallet) && receiverWallets.length > 0;
  const { mounted: transferMounted, visible: transferVisible } =
    useOverlayPresence(transferSheetOpen);
  const selectedDisplayName =
    selectedPortfolioWalletId === 'all'
      ? 'All Wallets'
      : selectedPortfolioWallet?.label?.trim() || (selectedPortfolioWallet ? shortenAddress(selectedPortfolioWallet.wallet_address, 4) : 'Unavailable wallet');
  const selectedNativeUi =
    selectedPortfolioWalletId === 'all'
      ? combinedNativeUi
      : balanceLamportsToSol(selectedPortfolioWallet?.balance_lamports ?? null);

  function onSelectFunder(id: string) {
    setFunderWalletId(id);
    setReceiverWalletIds((current) => current.filter((walletId) => walletId !== id));
  }

  function toggleReceiver(id: string) {
    if (id === funderWalletId) return;
    setReceiverWalletIds((current) =>
      current.includes(id) ? current.filter((walletId) => walletId !== id) : [...current, id],
    );
  }

  function openWalletAnalytics(walletAddress: string) {
    openWalletIntel({ address: walletAddress, chain: activeChain, rowDemo: true });
  }

  async function persistImportedPointerRow(address: string) {
    const token = await getAccessToken();
    if (!token) throw new Error('no_token');
    const res = await authJson<{ wallet: MyWalletRow }>(token, '/api/wallets/create', {
      method: 'POST',
      body: JSON.stringify({ wallet_address: address, is_imported: true }),
    });
    if (!res.ok && res.status !== 409) throw new Error(res.message);
    void qc.invalidateQueries({ queryKey: ['wallets-my'] });
    void qc.invalidateQueries({ queryKey: ['portfolio'] });
  }

  async function onCreateEmbedded() {
    setCreating(true);
    setCreateMenuOpen(false);
    try {
      const { wallet: w } = await createWallet({ createAdditional: true });
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      const res = await authJson<{ wallet: MyWalletRow }>(token, '/api/wallets/create', {
        method: 'POST',
        body: JSON.stringify({ wallet_address: w.address }),
      });
      if (!res.ok && res.status !== 409) throw new Error(res.message);
      toast.success('Wallet created');
      void qc.invalidateQueries({ queryKey: ['wallets-my'] });
      void qc.invalidateQueries({ queryKey: ['portfolio'] });
    } catch (e) {
      toast.error('Could not create wallet', {
        description: e instanceof Error ? e.message : 'Unknown error',
      });
    } finally {
      setCreating(false);
    }
  }

  const portfolio = query.data ?? EMPTY_PORTFOLIO;
  const positions = portfolio.positions ?? EMPTY_POSITIONS;
  const closed = portfolio.closedSells ?? EMPTY_CLOSED_SELLS;
  const trades = portfolio.trades ?? EMPTY_TRADES;

  const rowsForSpotTable = useMemo(() => {
    if (spotTableTab === 'active_positions') return positions;
    if (spotTableTab === 'history') return closed;
    return [...positions].sort((a, b) => (b.valueUsd ?? 0) - (a.valueUsd ?? 0)).slice(0, 100);
  }, [spotTableTab, positions, closed]);

  const filteredRows = useMemo(() => {
    const q = searchTable.trim().toLowerCase();
    return rowsForSpotTable.filter((r) => {
      const symbol = 'symbol' in r ? (r.symbol ?? '') : '';
      const mint = r.mint ?? '';
      if (!showHidden && 'balanceRaw' in r && r.balanceRaw === '0') return false;
      if (!q) return true;
      return symbol.toLowerCase().includes(q) || mint.toLowerCase().includes(q);
    });
  }, [rowsForSpotTable, searchTable, showHidden]);

  const btc = tickersQ.data?.find((t) => t.symbol === 'BTC');

  if (!authenticated) {
    return (
      <div
        className={cn(
          'rounded-md border border-border-subtle bg-bg-base p-6 text-sm text-fg-secondary',
          className,
        )}
      >
        Sign in to view portfolio.
      </div>
    );
  }

  if (awaitingWalletListForSelection) {
    return (
      <div className={cn('flex h-full min-h-[320px] items-center justify-center', className)}>
        <Loader2 className="h-6 w-6 animate-spin text-[#5865F2]" />
      </div>
    );
  }

  if (selectedWalletMissing) {
    return (
      <div
        className={cn(
          'rounded-md border border-border-subtle bg-bg-base p-6 text-sm text-fg-secondary',
          className,
        )}
      >
        Wallet unavailable on {nativeSym}. Switch chains or select All Wallets to view combined wallets
        on the current chain.
      </div>
    );
  }

  const portfolioShowsLoadingSpinner =
    portfolioEnabled && query.isPending && query.fetchStatus === 'fetching';
  if (portfolioShowsLoadingSpinner) {
    return (
      <div className={cn('flex h-full min-h-[320px] items-center justify-center', className)}>
        <Loader2 className="h-6 w-6 animate-spin text-[#5865F2]" />
      </div>
    );
  }

  if (portfolioEnabled && query.isError) {
    return (
      <div className={cn('rounded border p-3 text-[12px] text-[#f87171]', className)} style={{ borderColor: BORDER, backgroundColor: PANEL }}>
        Could not load portfolio.
      </div>
    );
  }

  return (
    <div className={cn('flex w-full flex-col text-[12px] text-white', className)}>
      <div className="flex shrink-0 items-center gap-3 border-b px-2 py-1" style={{ borderColor: BORDER }}>
        {([
          ['spot', 'Spot'],
          ['wallets', 'Wallets'],
          ['trackers', 'Trackers'],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              'relative pb-1 text-[13px] transition',
              tab === id ? 'font-semibold text-white' : 'text-[#6b7280] hover:text-[#d1d5db]',
            )}
          >
            {label}
            {tab === id ? <span className="absolute inset-x-0 -bottom-[1px] h-[2px] rounded-full bg-[#5865F2]" /> : null}
          </button>
        ))}
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b px-2 py-2" style={{ borderColor: BORDER }}>
        <PortfolioWalletSelector
          containerRef={walletSelectorRef}
          open={walletSelectorOpen}
          onOpenChange={setWalletSelectorOpen}
          search={walletSelectorSearch}
          onSearchChange={setWalletSelectorSearch}
          visibleWalletCount={visibleWallets.length}
          walletsFiltered={selectorWallets}
          allVisible={visibleWallets}
          selectedId={selectedPortfolioWalletId}
          onSelectAll={() => {
            setSelectedPortfolioWalletId('all');
            setWalletSelectorOpen(false);
          }}
          onSelectWallet={(w) => {
            setSelectedPortfolioWalletId(w.id);
            setFunderWalletId(w.id);
            setWalletSelectorOpen(false);
          }}
          combinedNative={combinedNativeUi}
          nativeSym={nativeSym}
          balanceOf={balanceLamportsToSol}
          selectedDisplayName={selectedDisplayName}
          selectedWallet={selectedPortfolioWallet}
          tradingWalletAddress={activeTradingAddress}
        />
        <span
          className={cn(
            'hidden rounded-xl border px-2.5 py-1.5 text-[11px] tabular-nums text-[#c7e4ff] sm:inline-flex sm:items-center sm:gap-1.5',
            OS.borderSoft,
            'bg-gradient-to-b from-[#151f2e]/90 to-[#0a0f14] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]',
          )}
          title="Balance for the selected portfolio scope"
        >
        <span className="text-[9px] font-semibold tracking-tight text-[#6b8299]">Scope</span>
          <span className="text-[12px] font-semibold tabular-nums text-[#7cdbcc]">
            {formatNumber(selectedNativeUi, { decimals: 4 })}{' '}
            <span className="text-[10px] text-[#5eead4]/85">{nativeSym}</span>
          </span>
        </span>
        <div className="ml-auto flex min-w-[230px] items-center gap-1.5">
          <div
            className={cn(
              'flex min-w-0 flex-1 items-center gap-2 rounded-xl border px-2.5 py-1.5 transition focus-within:border-[#4a6fa0]/80 focus-within:ring-1 focus-within:ring-[#3b6ea5]/25',
              OS.borderSoft,
              'bg-[#080d14]/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
            )}
          >
            <Search className="h-3.5 w-3.5 shrink-0 text-[#5f7390]" strokeWidth={2.2} />
            <input
              value={searchWallets}
              onChange={(e) => setSearchWallets(e.target.value)}
              placeholder="Filter wallets in list…"
              className="min-w-0 flex-1 border-0 bg-transparent text-[11px] text-white outline-none placeholder:text-[#4b5563]"
            />
          </div>
          {(['1d', '7d', '30d', 'max'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setTimeFilter(f)}
              className={cn('rounded px-1.5 py-1 text-[10px] font-semibold uppercase', timeFilter === f ? 'bg-white/10 text-white' : 'text-[#6b7280] hover:text-[#d1d5db]')}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {tab === 'spot' ? (
        <div className="flex flex-col gap-2 p-1">
          <section className="grid shrink-0 grid-cols-12 overflow-hidden rounded-lg border" style={{ borderColor: BORDER, backgroundColor: PANEL }}>
            <div className="col-span-12 border-b p-3 md:col-span-3 md:border-b-0 md:border-r" style={{ borderColor: BORDER }}>
              <h3 className="text-[11px] font-semibold tracking-tight text-[#929fb3]">Balance</h3>
              <div className="mt-2 space-y-2 text-[11px]">
                <div>
                  <div className="text-[10px] text-[#677486]">Total value</div>
                  <div className="text-[18px] font-semibold tabular-nums tracking-tight text-white">{formatCompactUsd(portfolio.summary.totalValueUsd)}</div>
                </div>
                <PerfRow label="Unrealized PNL" value={formatUsd(portfolio.summary.unrealizedPnlUsd)} />
                <PerfRow label="Tradeable Balance" value={`${formatNumber(selectedNativeUi, { decimals: 4 })} ${nativeSym}`} />
              </div>
            </div>
            <div className="col-span-12 border-b px-3 py-2.5 md:col-span-6 md:border-b-0 md:border-r" style={{ borderColor: BORDER }}>
              <div className="mb-1 flex items-center justify-between">
                <h3 className="text-[11px] font-semibold tracking-tight text-[#929fb3]">Realized PnL</h3>
                <span className="text-[10px] tabular-nums text-[#677486]">{timeFilter}</span>
              </div>
              <TinyLineChart positive={portfolio.summary.realizedPnlUsd >= 0} empty={trades.length === 0 && positions.length === 0} />
            </div>
            <div className="col-span-12 px-3 py-3 md:col-span-3">
              <div className="flex items-start justify-between gap-2 pb-2">
                <h3 className="text-[11px] font-semibold tracking-tight text-[#929fb3]">Performance</h3>
                <span className="shrink-0 rounded border border-[#283040] bg-[#080d14] px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-[#7d8b9f]">
                  30d
                </span>
              </div>
              <div className="-mx-0.5 border-t border-white/[0.045] pt-2">
                <PerfRow label="30d Total PNL" value={formatUsd(portfolio.summary.totalPnlUsd)} />
                <PerfRow label="30d Realized PNL" value={formatUsd(portfolio.summary.realizedPnlUsd)} />
                <PerfRow label="30d TXNS" value={String(trades.length)} />
              </div>
              <div className="mt-2 border-t border-white/[0.045] pt-2">
                <p className="mb-2 text-[10px] font-semibold tracking-tight text-[#75869c]">Return buckets</p>
                <PerfRow label="> 500%" value="0" bar={0} />
                <PerfRow label="200% - 500%" value="0" bar={0} />
                <PerfRow label="0% - 200%" value={String(Math.floor(trades.length / 2))} bar={35} />
                <PerfRow label="0% - 50%" value={String(Math.floor(trades.length / 3))} bar={20} />
                <PerfRow label="< -50%" value={String(Math.floor(trades.length / 6))} bar={12} />
              </div>
            </div>
          </section>

          <div className="mt-2 grid grid-cols-12 gap-2 md:mt-1 md:gap-1">
            <section className="col-span-12 flex flex-col rounded border md:col-span-8" style={{ borderColor: BORDER, backgroundColor: PANEL }}>
              <div className="flex flex-wrap items-center gap-1 border-b px-2 py-0.5" style={{ borderColor: BORDER }}>
                {([
                  ['active_positions', 'Active Positions'],
                  ['history', 'History'],
                  ['top100', 'Top 100'],
                ] as const).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSpotTableTab(id)}
                    className={cn('relative px-1.5 py-1 text-[11px] font-medium', spotTableTab === id ? 'text-white after:absolute after:inset-x-1 after:bottom-0 after:h-px after:bg-[#5865F2]' : 'text-[#6b7280] hover:text-[#d1d5db]')}
                  >
                    {label}
                  </button>
                ))}
                <div className="ml-auto flex items-center gap-1">
                  <div className="flex items-center gap-1 rounded border px-2 py-0.5" style={{ borderColor: BORDER, backgroundColor: '#080d14' }}>
                    <Search className="h-3 w-3 text-[#6b7280]" />
                    <input
                      value={searchTable}
                      onChange={(e) => setSearchTable(e.target.value)}
                      placeholder="Search by name or address"
                      className="w-36 border-0 bg-transparent text-[10px] text-white outline-none placeholder:text-[#4b5563]"
                    />
                  </div>
                  <label className="inline-flex items-center gap-1 text-[10px] text-[#6b7280]">
                    <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} className="h-3 w-3" />
                    Show Hidden
                  </label>
                  <button onClick={() => setUsdMode((v) => !v)} className="rounded border px-1.5 py-0.5 text-[10px] font-semibold" style={{ borderColor: BORDER }}>
                    {usdMode ? 'USD' : nativeSym}
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-[11px]">
                  <thead className="sticky top-0" style={{ backgroundColor: PANEL2 }}>
                    <tr className="border-b" style={{ borderColor: BORDER }}>
                      <th className="px-2 py-1.5 text-left text-[10px] font-semibold tracking-tight text-[#7c8b9f]">Token</th>
                      <th className="px-2 py-1.5 text-right text-[10px] font-semibold tracking-tight tabular-nums text-[#7c8b9f]">Bought</th>
                      <th className="px-2 py-1.5 text-right text-[10px] font-semibold tracking-tight tabular-nums text-[#7c8b9f]">Sold</th>
                      <th className="px-2 py-1.5 text-right text-[10px] font-semibold tracking-tight tabular-nums text-[#7c8b9f]">PnL</th>
                      <th className="px-2 py-1.5 text-right text-[10px] font-semibold tracking-tight text-[#7c8b9f]">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row, i) => {
                      const mint = row.mint;
                      const symbol = row.symbol ?? shortenAddress(mint, 4);
                      const pnl = 'realizedPnlUsd' in row ? row.realizedPnlUsd : (row.unrealizedPnlUsd ?? 0);
                      const bought = 'costBasisSol' in row ? row.costBasisSol : 0;
                      const sold = 'solProceeds' in row ? row.solProceeds : 0;
                      return (
                        <tr key={`${mint}-${i}`} className="border-b hover:bg-white/[0.04]" style={{ borderColor: BORDER, backgroundColor: i % 2 === 0 ? '#080d14' : '#151826' }}>
                          <td className="px-2 py-1"><div className="flex items-center gap-1.5"><span className="h-4 w-4 rounded bg-[#20263a]" /><span className="font-medium text-white">{symbol}</span></div></td>
                          <td className="px-2 py-1 text-right tabular-nums text-[#34d399]">{usdMode ? formatUsd(bought) : `${formatNumber(bought, { decimals: 4 })} ${nativeSym}`}</td>
                          <td className="px-2 py-1 text-right tabular-nums text-[#fb7185]">{usdMode ? formatUsd(sold) : `${formatNumber(sold, { decimals: 4 })} ${nativeSym}`}</td>
                          <td className={cn('px-2 py-1 text-right tabular-nums', pnl >= 0 ? 'text-[#34d399]' : 'text-[#fb7185]')}>{usdMode ? formatUsd(pnl) : `${formatNumber((pnl ?? 0) / Math.max(1, portfolio.solUsd ?? 150), { decimals: 4 })} ${nativeSym}`}</td>
                          <td className="px-2 py-1 text-right">
                            <div className="inline-flex items-center gap-1 text-[#6b7280]">
                              <button
                                type="button"
                                onClick={() => {
                                  void navigator.clipboard.writeText(mint);
                                  toast.success('Token address copied');
                                }}
                                className="rounded p-1 hover:bg-white/5 hover:text-white"
                                title="Copy token address"
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </button>
                              <Link href={`/token/${mint}`} className="rounded p-1 hover:bg-white/5 hover:text-white" title="Open token">
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredRows.length === 0 ? <PortfolioPlaceholderRows /> : null}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="col-span-12 flex flex-col rounded border md:col-span-4" style={{ borderColor: BORDER, backgroundColor: PANEL }}>
              <div
                className="border-b px-3 py-2.5"
                style={{ borderColor: 'rgba(255,255,255,0.06)' }}
              >
                <h3 className="text-[11px] font-semibold tracking-tight text-[#929fb3]">Activity</h3>
              </div>
              <div className="px-1.5 pb-3 pt-2 sm:px-2">
                {trades.length > 0 ? (
                  <table className="w-full table-fixed border-separate border-spacing-0 text-left text-[11px]">
                    <thead className="sticky top-0 z-[1]" style={{ backgroundColor: PANEL2 }}>
                      <tr className="border-b border-white/[0.05]">
                        <th scope="col" className="w-[4.5rem] whitespace-nowrap px-2 py-2.5 text-left text-[10px] font-semibold tracking-tight text-[#7c8b9f]">
                          Type
                        </th>
                        <th scope="col" className="min-w-0 px-2 py-2.5 text-left text-[10px] font-semibold tracking-tight text-[#7c8b9f]">
                          Token
                        </th>
                        <th scope="col" className="w-[5.75rem] whitespace-nowrap px-2 py-2.5 text-right text-[10px] font-semibold tracking-tight tabular-nums text-[#7c8b9f] sm:w-[28%]">
                          Amount
                        </th>
                        <th scope="col" className="hidden px-2 py-2.5 text-right text-[10px] font-semibold tracking-tight text-[#7c8b9f] sm:table-cell md:w-[20%]">
                          M.Cap
                        </th>
                        <th scope="col" className="min-w-[3.75rem] px-2 py-2.5 pr-4 text-right text-[10px] font-semibold tracking-tight tabular-nums text-[#7c8b9f] sm:min-w-0 md:w-[16%]">
                          Age
                        </th>
                        <th scope="col" className="w-[2.875rem] px-2 py-2.5 text-center text-[10px] font-semibold tracking-tight text-[#7c8b9f]" title="Explorer">
                          <ExternalLink className="mx-auto h-3 w-3 opacity-60" aria-hidden />
                          <span className="sr-only">Explorer</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {trades.map((t, i) => (
                        <tr
                          key={t.id}
                          className="border-b border-white/[0.04] transition-colors hover:bg-white/[0.045]"
                          style={{
                            borderColor: 'rgba(255,255,255,0.06)',
                            backgroundColor: i % 2 === 0 ? '#080d14' : '#151826',
                          }}
                        >
                          <td className="px-2 py-2.5 align-middle">
                            <span
                              className={cn(
                                'inline-flex min-w-[2.25rem] justify-center rounded border px-1.5 py-px text-[9px] font-semibold tracking-tight capitalize',
                                t.side === 'buy'
                                  ? 'border-emerald-500/35 bg-emerald-500/[0.11] text-emerald-300'
                                  : 'border-rose-500/35 bg-rose-500/[0.11] text-rose-300',
                              )}
                            >
                              {t.side}
                            </span>
                          </td>
                          <td className="min-w-0 px-2 py-2.5 align-middle text-[11px] font-medium leading-snug text-[#dae6f5]">
                            <div className="flex min-w-0 items-center gap-0.5 sm:gap-1">
                              <span className="min-w-0 flex-1 truncate" title={t.mint}>
                                {shortenAddress(t.mint, 4)}
                              </span>
                              <a
                                href={xLiveSearchContractUrl(t.mint)}
                                target="_blank"
                                rel="noreferrer"
                                className="shrink-0 rounded-md p-1.5 text-[#6e8cae] hover:bg-white/[0.06] hover:text-[#93c5fd]"
                                aria-label="Search contract on X"
                                title="Search contract on X"
                              >
                                <Search className="h-4 w-4 sm:h-3.5 sm:w-3.5" strokeWidth={2.2} aria-hidden />
                              </a>
                            </div>
                          </td>
                          <td className="px-2 py-2.5 text-right align-middle text-[11px] font-medium tabular-nums tracking-normal text-[#e4eaf2]">
                            {t.amountSol != null ? (
                              formatNumber(t.amountSol, { decimals: 3 })
                            ) : (
                              <span className="text-[13px] font-normal tabular-nums text-[#4a586e]">—</span>
                            )}
                          </td>
                          <td className="hidden px-2 py-2.5 text-right align-middle tabular-nums text-[11px] sm:table-cell">
                            <span className="inline-block tabular-nums text-[13px] text-[#4a586e]">—</span>
                          </td>
                          <td className="px-2 py-2.5 pr-3 text-right align-middle tabular-nums text-[11px] text-[#7d8ea3]">
                            {formatRelativeTime(t.submittedAt)}
                          </td>
                          <td className="px-1.5 py-2 text-center align-middle sm:px-2">
                            <a
                              href={explorerUrlSolanaTx(t.txSignature)}
                              target="_blank"
                              rel="noreferrer"
                              className="mx-auto inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#6e8cae] transition-colors hover:bg-white/[0.06] hover:text-[#93c5fd]"
                              aria-label="Open transaction on explorer"
                              title="View on explorer"
                            >
                              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="flex min-h-[180px] flex-col items-center justify-center px-3 text-[#546277]">
                    <EyeOff className="h-8 w-8 opacity-75" strokeWidth={1.5} />
                    <p className="mt-2 text-[11px] font-medium text-[#7d8e9f]">No activity</p>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      ) : null}

      {tab === 'wallets' ? (
        <div className="grid grid-cols-12 gap-2 p-2 md:gap-3 md:p-3">
          <section
            className="col-span-12 flex flex-col overflow-hidden rounded-xl border shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] md:col-span-6"
            style={{ borderColor: BORDER, background: `linear-gradient(180deg, ${PANEL} 0%, #0a0e14 100%)` }}
          >
            <div
              className="flex flex-wrap items-center gap-2 border-b px-3 py-2.5"
              style={{ borderColor: BORDER }}
            >
              <div
                className={cn(
                  'flex min-w-[140px] flex-1 items-center gap-2 rounded-xl border px-2.5 py-1.5 transition focus-within:border-[#4a6fa0]/80 focus-within:ring-1 focus-within:ring-[#3b6ea5]/25',
                  OS.borderSoft,
                  'bg-[#080d14]/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
                )}
              >
                <Search className="h-3.5 w-3.5 shrink-0 text-[#5f7390]" strokeWidth={2.2} />
                <input
                  value={searchWallets}
                  onChange={(e) => setSearchWallets(e.target.value)}
                  placeholder="Search by name or address…"
                  className="min-w-0 flex-1 border-0 bg-transparent text-[11px] text-white outline-none placeholder:text-[#4b5563]"
                />
              </div>
              <label className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-black/30 px-2 py-1.5 text-[10px] text-[#8b9aad]">
                <input
                  type="checkbox"
                  checked={showHidden}
                  onChange={(e) => setShowHidden(e.target.checked)}
                  className="h-3 w-3 rounded border-[#3d556d] bg-[#0a0f14] text-[#5865F2] focus:ring-[#3b6ea5]/40"
                />
                Archived
              </label>
              <button
                type="button"
                onClick={() => setImportOpen(true)}
                className={cn(
                  'rounded-xl border px-2.5 py-1.5 text-[10px] font-semibold text-[#d1dce8] transition hover:border-[#4f7096]/90 hover:text-white',
                  OS.borderSoft,
                  'bg-[#0d1520]/80',
                )}
              >
                Import
              </button>
              <div className="relative ml-auto">
                <button
                  type="button"
                  onClick={() => setCreateMenuOpen((v) => !v)}
                  disabled={creating}
                  className="inline-flex items-center gap-1 rounded-xl bg-[#5865F2] px-2.5 py-1.5 text-[10px] font-semibold text-[#0a0a0f] shadow-[0_8px_24px_-12px_rgba(88,101,242,0.55)] disabled:opacity-50"
                >
                  {creating ? 'Creating' : 'Create'}{' '}
                  <ChevronDown className="h-3 w-3 opacity-90" />
                </button>
                {createMenuOpen ? (
                  <div
                    className={cn(
                      'absolute right-0 top-[calc(100%+8px)] z-40 w-32 overflow-hidden rounded-xl border p-1 shadow-2xl animate-in fade-in zoom-in-95 duration-150',
                      OS.border,
                      OS.glass,
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => void onCreateEmbedded()}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[11px] font-semibold text-[#e8eef5] transition hover:bg-white/[0.06]"
                    >
                      <Wallet className="h-3.5 w-3.5 opacity-90" /> Wallet
                    </button>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="space-y-1.5 px-2 pb-5 pt-2">
              <div className="mb-1 hidden grid-cols-12 gap-2 px-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#5f738e] md:grid">
                <span className="col-span-5 pl-1">Wallet</span>
                <span className="col-span-3">Address</span>
                <span className="col-span-2 text-right">Balance</span>
                <span className="col-span-2 text-right">Status · actions</span>
              </div>

              {walletRows.map((w) => {
                const trading = activeTradingAddress === w.wallet_address;
                return (
                  <WalletTableRowShell
                    key={w.id}
                    selected={selectedPortfolioWalletId === w.id}
                    onClick={() => {
                      setSelectedPortfolioWalletId(w.id);
                      setFunderWalletId(w.id);
                    }}
                    onDoubleClick={() => openWalletAnalytics(w.wallet_address)}
                  >
                    <div className="flex flex-col gap-3 md:grid md:grid-cols-12 md:items-center md:gap-2">
                      <div className="flex min-w-0 items-start justify-between gap-3 md:col-span-5">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <WalletMonogram address={w.wallet_address} label={w.label} />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1">
                              <span className="truncate text-[12.5px] font-semibold text-white">
                                {w.label?.trim() || shortenAddress(w.wallet_address, 4)}
                              </span>
                              {trading ? (
                                <span className="rounded border border-cyan-900/50 bg-cyan-950/35 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-cyan-100/90">
                                  Live
                                </span>
                              ) : null}
                              {w.is_primary ? (
                                <span className="rounded border border-[#4a62d6]/40 bg-[#2f3f8a]/20 px-1.5 py-px text-[9px] font-bold uppercase text-[#b8c7ff]">
                                  Primary
                                </span>
                              ) : null}
                            </div>
                            <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-[#6d8098]">
                              <span
                                className={cn(
                                  'inline-block h-1.5 w-1.5 rounded-full ring-2 ring-black/30',
                                  w.is_active && !w.is_archived ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.45)]' : 'bg-[#4b5563]',
                                )}
                              />
                              <span>{w.is_imported ? 'Imported' : 'Embedded'}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right md:hidden">
                          <div className="text-[13px] font-semibold tabular-nums text-[#7cdbcc]">
                            {formatNumber(balanceLamportsToSol(w.balance_lamports), { decimals: 3 })}{' '}
                            <span className="text-[10px] font-medium text-[#5f738e]">{nativeSym}</span>
                          </div>
                        </div>
                      </div>

                      <div className="hidden tabular-nums tracking-tight text-[11px] text-[#94a3b8] md:col-span-3 md:block">
                        {shortenAddress(w.wallet_address, 8)}
                      </div>

                        <div className="hidden text-right md:col-span-2 md:block">
                        <div className="text-[12px] font-semibold tabular-nums text-[#7cdbcc]">
                          {formatNumber(balanceLamportsToSol(w.balance_lamports), { decimals: 3 })}
                        </div>
                        <div className="text-[9px] font-medium uppercase tracking-wide text-[#5f738e]">{nativeSym}</div>
                      </div>

                      <div className="flex items-center justify-between gap-3 md:col-span-2">
                        <div className="tabular-nums tracking-tight text-[10px] text-[#6d8098] md:hidden">{shortenAddress(w.wallet_address, 6)}</div>
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                            w.is_archived
                              ? 'border border-amber-500/25 bg-amber-500/10 text-amber-200'
                              : w.is_active
                                ? 'border border-emerald-500/25 bg-emerald-500/10 text-emerald-200'
                                : 'border border-white/[0.08] bg-white/[0.04] text-[#9ca3af]',
                          )}
                        >
                          {w.is_archived ? 'Archived' : w.is_active ? 'Active' : 'Idle'}
                        </span>
                        <div className="flex justify-end gap-0.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openWalletAnalytics(w.wallet_address);
                            }}
                            className="rounded-lg p-1.5 text-[#7a8c9f] transition hover:bg-white/[0.08] hover:text-white"
                            title="Open analytics"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void navigator.clipboard.writeText(w.wallet_address);
                              toast.success('Address copied');
                            }}
                            className="rounded-lg p-1.5 text-[#7a8c9f] transition hover:bg-white/[0.08] hover:text-white"
                            title="Copy address"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          <a
                            href={explorerAccountUrlForChain(w.wallet_address, activeChain)}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex rounded-lg p-1.5 text-[#7a8c9f] transition hover:bg-white/[0.08] hover:text-[#9ee7ff]"
                            title="View explorer"
                          >
                            ↗
                          </a>
                        </div>
                      </div>
                    </div>
                  </WalletTableRowShell>
                );
              })}

              {walletRows.length === 0 ? (
                <div
                  className={cn(
                    'flex min-h-[200px] flex-col items-center justify-center rounded-xl border border-dashed px-4 py-10 text-center',
                    OS.borderSoft,
                  )}
                >
                  <Wallet className="mb-2 h-8 w-8 text-[#3d556d]" strokeWidth={1.5} />
                  <p className="text-[12px] font-medium text-[#9ca3af]">No wallets on {nativeSym}</p>
                  <p className="mt-1 max-w-[240px] text-[11px] leading-relaxed text-[#6b7280]">
                    Import an external wallet or create an embedded one to begin routing capital.
                  </p>
                </div>
              ) : null}
            </div>
          </section>

          <section
            className="col-span-12 flex flex-col overflow-hidden rounded-xl border md:col-span-6"
            style={{ borderColor: BORDER, background: `linear-gradient(180deg, ${PANEL} 0%, #080c11 100%)` }}
          >
            <div
              className="border-b px-3 py-2.5"
              style={{ borderColor: BORDER, background: 'linear-gradient(90deg, rgba(59,130,214,0.06) 0%, transparent 55%)' }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#7d8ea3]">Capital routing</h3>
                  <p className="mt-0.5 text-[10px] text-[#5f738e]">Source a balance, fan out to receivers, preview the split.</p>
                </div>
                <span className="rounded-full border border-[#2f4a66]/80 bg-black/40 px-2.5 py-1 text-[10px] font-medium tabular-nums text-[#8ea3bd]">
                  {funderWallet ? '1 source' : '0 sources'} · {receiverWallets.length} rcv
                </span>
              </div>
            </div>

            <div className="space-y-3 p-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <SummaryTile label="Wallets" value={String(visibleWallets.length)} />
                <SummaryTile label="Total" value={`${formatNumber(combinedNativeUi, { decimals: 3 })}`} sub={nativeSym} />
                <SummaryTile label="Active" value={String(visibleWallets.filter((x) => x.is_active && !x.is_archived).length)} />
                <SummaryTile label="Receivers" value={String(receiverWallets.length)} />
              </div>

              <div
                className={cn(
                  'rounded-xl border p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]',
                  OS.borderSoft,
                  'bg-gradient-to-b from-[#101722]/95 to-[#070b10]',
                )}
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#5f738e]">01 — Source</p>
                <div className="mt-2" ref={funderPickerRef}>
                  <CapitalFunderPicker
                    open={funderPickerOpen}
                    onOpenChange={setFunderPickerOpen}
                    wallets={visibleWallets}
                    funderId={funderWalletId}
                    onSelectFunder={onSelectFunder}
                    nativeSym={nativeSym}
                    balanceOf={balanceLamportsToSol}
                    receiverIds={receiverIdSet}
                  />
                </div>
              </div>

              <CapitalFlowArrow />

              <div
                className={cn(
                  'rounded-xl border p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]',
                  OS.borderSoft,
                  'bg-gradient-to-b from-[#101722]/95 to-[#070b10]',
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#5f738e]">02 — Receivers</p>
                    <p className="mt-0.5 text-[10px] text-[#5f738e]">Equal split · tap to toggle</p>
                  </div>
                  <span className="rounded-md border border-white/[0.06] bg-black/35 px-2 py-0.5 text-[10px] font-medium tabular-nums text-[#8ea3bd]">
                    {receiverWallets.length} selected
                  </span>
                </div>
                <div className="mt-3 grid max-h-[220px] gap-1.5 overflow-y-auto sm:grid-cols-2">
                  {visibleWallets.map((w) => {
                    const disabled = w.id === funderWalletId;
                    const checked = receiverWalletIds.includes(w.id);
                    return (
                      <button
                        key={w.id}
                        type="button"
                        disabled={disabled}
                        onClick={() => toggleReceiver(w.id)}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-lg border px-2 py-2 text-left text-[11px] transition disabled:cursor-not-allowed disabled:opacity-35',
                          checked
                            ? 'border-[#4f7ab8]/55 bg-[#1a2c42]/60 shadow-[inset_3px_0_0_0_#3b9fd6]'
                            : 'border-[#2a3d54]/70 bg-[#0c121c]/90 hover:border-[#3f5f80]/55 hover:bg-[#121a26]/90',
                        )}
                      >
                        <WalletMonogram address={w.wallet_address} label={w.label} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold text-white">
                            {w.label?.trim() || shortenAddress(w.wallet_address, 4)}
                          </span>
                          <span className="block truncate tabular-nums tracking-tight text-[10px] text-[#6d8098]">
                            {shortenAddress(w.wallet_address, 5)}
                            {disabled ? ' · source' : ''}
                          </span>
                        </span>
                        <span
                          className={cn(
                            'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition',
                            checked ? 'border-[#5b8cff] bg-[#5865F2] text-white shadow-[0_0_12px_-4px_rgba(88,101,242,0.75)]' : 'border-white/20',
                          )}
                        >
                          {checked ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                <div
                  className={cn(
                    'rounded-xl border px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] focus-within:ring-1 focus-within:ring-[#3b6ea5]/30',
                    OS.borderSoft,
                    'bg-gradient-to-b from-[#0c1422]/98 to-black/45',
                  )}
                >
                  <label className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#5f738e]">
                    Total to route ({nativeSym})
                  </label>
                  <input
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    placeholder={nativeSym === 'SOL' ? '0.00' : '0'}
                    inputMode="decimal"
                    className="mt-1 w-full border-0 bg-transparent py-0.5 text-[20px] font-semibold tabular-nums tracking-tight text-white outline-none placeholder:text-[#3d4f66]"
                  />
                  <p className="mt-1 text-[10px] text-[#5f738e]">
                    Execution preview only — confirms split math before handoff.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (funderWallet && receiverWallets.length > 0 && transferAmount.trim()) setTransferOpen(true);
                  }}
                  disabled={!funderWallet || receiverWallets.length === 0 || !transferAmount.trim()}
                  className="h-11 min-w-[132px] rounded-xl bg-[#5865F2] px-4 text-[11px] font-bold text-white shadow-[0_12px_40px_-18px_rgba(88,101,242,0.55)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                  title={!funderWallet || receiverWallets.length === 0 ? 'Select one funder and at least one receiver' : undefined}
                >
                  Preview split
                </button>
              </div>

              <div className="rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/[0.12] to-transparent px-3 py-2.5 text-[11px] leading-relaxed text-[#a8b8c9]">
                <span className="font-semibold text-emerald-100/90">Split preview ·</span> one source sends the full amount; it is divided evenly across every selected
                receiver.
                {receiverWallets.length > 0 && transferAmount.trim() ? (
                  <span className="mt-1 block text-[#c7e4ff]">
                    Each receiver ≈{' '}
                    <span className="font-semibold tabular-nums text-[#7cdbcc]">
                      {formatNumber(Number(transferAmount) / Math.max(1, receiverWallets.length) || 0, { decimals: 5 })}{' '}
                      {nativeSym}
                    </span>
                  </span>
                ) : null}
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {tab === 'trackers' ? (
        <div className="flex min-h-0 flex-1 flex-col p-1 sm:p-2">
          <TrackersPanel className="min-h-0 flex-1" prefillWallet={prefillTrackerWallet} />
        </div>
      ) : null}

      <div className="flex shrink-0 items-center justify-between border-t px-2 py-1 text-[10px]" style={{ borderColor: BORDER }}>
        <div className="flex items-center gap-2">
          <span className="text-[#6b7280]">BTC</span>
          <span className="tabular-nums text-white">{btc?.usdPrice != null ? `$${formatNumber(btc.usdPrice, { decimals: 2 })}` : '—'}</span>
          <span className={cn('tabular-nums', (btc?.priceChange24h ?? 0) >= 0 ? 'text-[#34d399]' : 'text-[#fb7185]')}>
            {btc?.priceChange24h != null ? `${btc.priceChange24h >= 0 ? '+' : ''}${formatNumber(btc.priceChange24h, { decimals: 2 })}%` : '—'}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[#6b7280]">
          <span>Vol {formatNumber(trades.length * 1.3, { decimals: 1, compact: true })}</span>
          <span>TX {trades.length}</span>
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/35 bg-emerald-500/10 px-1.5 py-px text-emerald-300"><Check className="h-3 w-3" /> Stable</span>
          <span>US-E</span>
        </div>
      </div>

      <ImportWalletModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={persistImportedPointerRow}
      />

      {transferMounted && funderWallet && receiverWallets.length > 0 ? (
        <TransferModal
          motionVisible={transferVisible}
          source={funderWallet}
          receivers={receiverWallets}
          nativeSym={nativeSym}
          amount={transferAmount}
          onAmountChange={setTransferAmount}
          onClose={() => setTransferOpen(false)}
          onSubmit={() => {
            toast.info('Transfer preview created', {
              description: 'Execution handoff will use the selected funder and equal receiver split.',
            });
            setTransferOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

function TransferModal({
  motionVisible,
  source,
  receivers,
  nativeSym,
  amount,
  onAmountChange,
  onClose,
  onSubmit,
}: {
  motionVisible: boolean;
  source: MyWalletRow;
  receivers: MyWalletRow[];
  nativeSym: string;
  amount: string;
  onAmountChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const available = balanceLamportsToSol(source.balance_lamports);
  const perReceiver = receivers.length > 0 ? Number(amount || 0) / receivers.length : 0;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation">
      <button
        type="button"
        className={cn(
          'absolute inset-0 bg-black/70',
          overlayBackdropClasses(motionVisible),
          'fill-mode-forwards',
        )}
        aria-label="Close transfer preview"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative w-full max-w-[360px] rounded border bg-[#17191f] shadow-2xl fill-mode-forwards',
          overlayPanelClasses(motionVisible),
        )}
        style={{ borderColor: BORDER }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-3 py-3" style={{ borderColor: BORDER }}>
          <h2 className="text-[13px] font-semibold text-white">
            Split from {source.label?.trim() || 'wallet'} to {receivers.length} wallet{receivers.length === 1 ? '' : 's'}
          </h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-[#9ca3af] hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3 p-3">
          <div
            className="flex w-full items-center justify-between rounded border px-3 py-2 text-[11px] font-semibold text-[#d1d5db]"
            style={{ borderColor: BORDER, backgroundColor: '#11141b' }}
          >
            <span className="inline-flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm bg-[#5865F2]" />
              {nativeSym}
            </span>
            <span className="text-[10px] text-[#6b7280]">Native asset</span>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-[#8b93a3]">Amount</label>
            <div className="flex gap-2">
              <div className="flex min-w-0 flex-1 items-center rounded border px-2" style={{ borderColor: BORDER, backgroundColor: '#11141b' }}>
                <input
                  value={amount}
                  onChange={(e) => onAmountChange(e.target.value)}
                  placeholder="Enter amount"
                  inputMode="decimal"
                  className="min-w-0 flex-1 border-0 bg-transparent py-2 text-[12px] text-white outline-none placeholder:text-[#4b5563]"
                />
                <span className="h-3 w-3 rounded-sm bg-[#5865F2]" />
              </div>
              <div className="flex w-14 items-center justify-center rounded border text-[11px] text-[#8b93a3]" style={{ borderColor: BORDER, backgroundColor: '#11141b' }}>
                0.0 %
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <div className="relative h-1 rounded-full bg-[#2a2f3a]">
              <div className="absolute left-0 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-[#5865F2]" />
            </div>
            <div className="flex justify-between text-[10px] text-[#8b93a3]">
              <span>0%</span>
              <span>25%</span>
              <span>50%</span>
              <span>75%</span>
              <span>100%</span>
            </div>
          </div>

          <div className="text-[11px] text-[#8b93a3]">
            Available: <span className="tabular-nums text-[#d1d5db]">{formatNumber(available, { decimals: 5 })} {nativeSym}</span>
          </div>
          <div className="rounded-md border border-white/[0.07] bg-white/[0.03] px-2 py-2 text-[11px] text-[#8b93a3]">
            <div className="flex justify-between">
              <span>Receivers</span>
              <span className="tabular-nums text-white">{receivers.length}</span>
            </div>
            <div className="flex justify-between">
              <span>Equal split</span>
              <span className="tabular-nums text-[#5eead4]">{formatNumber(perReceiver || 0, { decimals: 5 })} {nativeSym}</span>
            </div>
          </div>
        </div>
        <div className="border-t p-3" style={{ borderColor: BORDER }}>
          <button
            type="button"
            onClick={onSubmit}
            disabled={!amount.trim()}
            className="w-full rounded-full bg-[#5865F2] py-2 text-[12px] font-semibold text-[#05070d] disabled:opacity-45"
          >
            Confirm Preview
          </button>
        </div>
      </div>
    </div>
  );
}

function TinyLineChart({ positive = true, empty = false }: { positive?: boolean; empty?: boolean }) {
  return (
    <div className="relative h-[86px] w-full overflow-hidden rounded border" style={{ borderColor: BORDER }}>
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.02),rgba(255,255,255,0))]" />
      <div className="absolute inset-0 grid grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="border-r last:border-r-0" style={{ borderColor: BORDER }} />
        ))}
      </div>
      <div className="absolute inset-0 grid grid-rows-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border-b last:border-b-0" style={{ borderColor: BORDER }} />
        ))}
      </div>
      {empty ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <p className="text-[12px] font-semibold text-[#d1d5db]">No PNL history yet</p>
          <p className="mt-1 text-[10px] text-[#6b7280]">Trades will appear here once this wallet has activity.</p>
        </div>
      ) : (
        <div className="absolute left-0 right-0 top-1/2 h-px" style={{ backgroundColor: positive ? '#10b981' : '#fb7185' }} />
      )}
    </div>
  );
}

function PortfolioPlaceholderRows() {
  return (
    <tr>
      <td colSpan={5} className="px-2 py-12 text-center">
        <div className="mx-auto max-w-xs">
          <p className="text-[12px] font-semibold text-[#d1d5db]">No active positions</p>
          <p className="mt-1 text-[11px] text-[#6b7280]">
            Positions will appear here after trades are detected.
          </p>
        </div>
      </td>
    </tr>
  );
}

function SummaryTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-md border px-2 py-2" style={{ borderColor: BORDER, backgroundColor: '#080d14' }}>
      <div className="text-[10px] text-[#6b7280]">{label}</div>
      <div className="mt-0.5 truncate text-[12px] font-semibold tabular-nums text-white">
        {value}
        {sub ? <span className="ml-1 text-[10px] font-medium text-[#5f738e]">{sub}</span> : null}
      </div>
    </div>
  );
}

function PerfRow({ label, value, bar }: { label: string; value: string; bar?: number }) {
  return (
    <div className="border-b border-white/[0.04] py-2.5 last:border-b-0">
      <div className="flex items-baseline justify-between gap-4">
        <span className="min-w-0 flex-1 text-[11px] font-medium leading-snug text-[#8b9db4]">{label}</span>
        <span className="shrink-0 text-right text-[14px] font-semibold tabular-nums tracking-normal text-[#e8edf4]">
          {value}
        </span>
      </div>
      {bar != null ? (
        <div className="mt-3 h-[5px] rounded-full bg-[#060a11] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ring-1 ring-white/[0.05]">
          <div
            className="h-full rounded-full bg-[#5865F2] shadow-[0_0_12px_-3px_rgba(88,101,242,0.45)]"
            style={{ width: `${Math.max(0, Math.min(100, bar))}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}
