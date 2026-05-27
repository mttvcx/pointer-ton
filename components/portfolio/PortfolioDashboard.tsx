'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { useCreateWallet, useExportWallet } from '@/lib/auth/solanaShims';
import { generateEmbeddedWalletForChain } from '@/lib/wallets/embeddedCreate';
import { explorerAccountUrlForChain } from '@/lib/chains/explorer';
import {
  Activity,
  ArrowLeftRight,
  Calendar,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  ImageUp,
  Loader2,
  Search,
  Wallet,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { toastCopied, toastCopyFailed } from '@/lib/ui/copyToast';
import type { MyWalletRow } from '@/lib/hooks/useActiveSolanaWallet';
import { useActiveSolanaWallet } from '@/lib/hooks/useActiveSolanaWallet';
import { ImportWalletModal } from '@/components/wallets/ImportWalletModal';
import { TrackersPanel } from '@/components/trackers/TrackersPanel';
import {
  PrivateTransferProviderModal,
  type PrivateTransferProvider,
} from '@/components/portfolio/PrivateTransferProviderModal';
import { SplitNowTransferModal } from '@/components/portfolio/SplitNowTransferModal';
import { explorerUrlSolanaTx } from '@/lib/chains/explorerUrls';
import { shortenAddress } from '@/lib/utils/addresses';
import { cn } from '@/lib/utils/cn';
import { useUIStore } from '@/store/ui';
import { useWalletIntelStore } from '@/store/walletIntelStore';
import { usePnlTrackerStore } from '@/store/pnlTracker';
import { usePnlCalendarStore } from '@/store/pnlCalendar';
import { useAuthSyncStore } from '@/store/authSync';
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
import { dispatchSolanaAccountRefresh } from '@/lib/client/portfolioRefreshEvents';
import { overlayBackdropClasses, overlayPanelClasses } from '@/lib/ui/overlayMotion';
import {
  CapitalFlowArrow,
  CapitalFunderPicker,
  OS,
  PortfolioWalletSelector,
  WalletMonogram,
} from '@/components/portfolio/walletOs';
import { PortfolioWalletTableRow } from '@/components/portfolio/PortfolioWalletTableRow';
import {
  WalletGroupsSidebar,
  filterWalletsByGroup,
} from '@/components/portfolio/WalletGroupsSidebar';
import { useWalletGroupsStore } from '@/store/walletGroups';
import { ChainIcon } from '@/components/squads/ChainIcon';

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

function tokenUiAmountFromRaw(raw: string | undefined, decimals: number): string {
  if (raw == null || raw.trim() === '') return '';
  try {
    const v = Number(BigInt(raw.trim())) / 10 ** Math.min(18, Math.max(0, decimals));
    if (!Number.isFinite(v)) return '';
    return formatNumber(v, { decimals: Math.min(6, decimals) });
  } catch {
    return '';
  }
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
  const backendReady = useAuthSyncStore((s) => s.backendReady);
  const authSyncing = useAuthSyncStore((s) => s.syncing);
  const authSyncError = useAuthSyncStore((s) => s.lastError);
  const activeChain = useUIStore((s) => s.activeChain);
  const openWalletIntel = useWalletIntelStore((s) => s.openWallet);
  const openPnlFromPortfolio = usePnlTrackerStore((s) => s.openFromPortfolio);
  const setPnlPortfolioScope = usePnlTrackerStore((s) => s.setPortfolioScope);
  const pnlTrackerOpen = usePnlTrackerStore((s) => s.open);
  const pnlPortfolioScope = usePnlTrackerStore((s) => s.portfolioScope);
  const qc = useQueryClient();
  const { createWallet } = useCreateWallet();
  const { exportWallet } = useExportWallet();
  const [tab, setTab] = useState<PortfolioTab>(initialTab ?? 'spot');
  const [spotTableTab, setSpotTableTab] = useState<SpotTableTab>('active_positions');
  const [spotActivityTab, setSpotActivityTab] = useState<'activity' | 'transfers'>('activity');
  const [selectedPortfolioWalletId, setSelectedPortfolioWalletId] =
    useState<PortfolioWalletSelection>('all');
  const [walletSelectorOpen, setWalletSelectorOpen] = useState(false);
  const [walletSelectorSearch, setWalletSelectorSearch] = useState('');
  const [searchWallets, setSearchWallets] = useState('');
  const [searchTable, setSearchTable] = useState('');
  const [selectedWalletGroupId, setSelectedWalletGroupId] = useState<string | null>(null);
  const walletGroups = useWalletGroupsStore((s) => s.groups);
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
  const [privateTransferOpen, setPrivateTransferOpen] = useState(false);
  const [splitNowOpen, setSplitNowOpen] = useState(false);
  const [funderPickerOpen, setFunderPickerOpen] = useState(false);
  const openPnlCalendar = usePnlCalendarStore((s) => s.openCalendar);
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
  const activeWallets = useMemo(
    () => chainWallets.filter((w) => !w.is_archived),
    [chainWallets],
  );
  const tableWallets = useMemo(
    () => chainWallets.filter((w) => (showHidden ? w.is_archived : !w.is_archived)),
    [chainWallets, showHidden],
  );
  const visibleWallets = activeWallets;
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
    retry: (count, err) => count < 2 && err instanceof Error && /sync/i.test(err.message),
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      const base = '/api/portfolio?tradesLimit=80&fifoLimit=400';
      const url = selectedWalletAddress
        ? `${base}&wallet=${encodeURIComponent(selectedWalletAddress)}`
        : base;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json: unknown = await res.json();
      if (!res.ok) {
        const msg =
          typeof json === 'object' && json
            ? 'message' in json
              ? String((json as { message: unknown }).message)
              : 'error' in json
                ? String((json as { error: unknown }).error)
                : 'portfolio failed'
            : 'portfolio failed';
        throw new Error(msg);
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
    const grouped = filterWalletsByGroup(tableWallets, selectedWalletGroupId, walletGroups);
    return grouped.filter((w) => {
      if (!q) return true;
      return (
        w.wallet_address.toLowerCase().includes(q) ||
        (w.label ?? '').toLowerCase().includes(q)
      );
    });
  }, [tableWallets, searchWallets, selectedWalletGroupId, walletGroups]);
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

  /** Keep floating PNL in sync when Portfolio wallet selector changes while tracker is open. */
  useEffect(() => {
    if (!pnlTrackerOpen || pnlPortfolioScope === null) return;
    setPnlPortfolioScope({
      walletAddress: selectedWalletAddress,
      label: selectedDisplayName,
    });
  }, [
    pnlTrackerOpen,
    pnlPortfolioScope,
    selectedWalletAddress,
    selectedDisplayName,
    setPnlPortfolioScope,
  ]);

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

  async function saveWalletLabel(walletId: string, label: string) {
    const token = await getAccessToken();
    if (!token) throw new Error('no_token');
    const res = await authJson<{ wallet: MyWalletRow }>(token, `/api/wallets/${walletId}`, {
      method: 'PATCH',
      body: JSON.stringify({ label }),
    });
    if (!res.ok) throw new Error(res.message);
    void qc.invalidateQueries({ queryKey: ['wallets-my'] });
    toast.success('Wallet renamed');
  }

  async function archiveWallet(walletId: string, archived: boolean) {
    const token = await getAccessToken();
    if (!token) throw new Error('no_token');
    const res = await authJson<{ wallet: MyWalletRow }>(token, `/api/wallets/${walletId}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_archived: !archived }),
    });
    if (!res.ok) throw new Error(res.message);
    void qc.invalidateQueries({ queryKey: ['wallets-my'] });
    toast.success(archived ? 'Wallet unarchived' : 'Wallet archived');
  }

  function onExportWalletKey(w: MyWalletRow) {
    if (w.is_imported) {
      toast.info('Private key isn’t stored in Pointer', {
        description:
          'Use the key or phrase you saved when you created or imported this wallet.',
      });
      return;
    }
    if (activeChain === 'sol') {
      void exportWallet({ address: w.wallet_address }).catch((e: unknown) => {
        toast.error('Export failed', {
          description: e instanceof Error ? e.message.slice(0, 200) : 'Unknown error',
        });
      });
      return;
    }
    toast.info('Linked wallet', {
      description: 'Keys stay in your wallet app — Pointer never receives your phrase.',
    });
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
    dispatchSolanaAccountRefresh('portfolio_wallet_import');
  }

  async function onCreateEmbedded() {
    setCreating(true);
    setCreateMenuOpen(false);
    try {
      let address: string;
      let isImported = false;
      if (activeChain === 'sol') {
        const { wallet: w } = await createWallet({ createAdditional: true });
        address = w.address;
      } else {
        const generated = await generateEmbeddedWalletForChain(activeChain);
        address = generated.address;
        isImported = true;
      }
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      const res = await authJson<{ wallet: MyWalletRow }>(token, '/api/wallets/create', {
        method: 'POST',
        body: JSON.stringify({
          wallet_address: address,
          ...(isImported ? { is_imported: true } : {}),
        }),
      });
      if (!res.ok && res.status !== 409) throw new Error(res.message);
      toast.success('Wallet created');
      void qc.invalidateQueries({ queryKey: ['wallets-my'] });
      void qc.invalidateQueries({ queryKey: ['portfolio'] });
      dispatchSolanaAccountRefresh('portfolio_wallet_create');
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
  const solUsdRate = portfolio.solUsd != null && portfolio.solUsd > 0 ? portfolio.solUsd : null;

  const formatBalancePrimary = (usd: number | null | undefined, compact = false) => {
    if (usdMode) {
      return compact ? formatCompactUsd(usd) : formatUsd(usd);
    }
    if (usd == null || !Number.isFinite(usd) || solUsdRate == null) return '\u2014';
    const native = usd / solUsdRate;
    const sign = native < 0 ? '-' : '';
    return `${sign}${formatNumber(Math.abs(native), { decimals: 4 })} ${nativeSym}`;
  };

  const formatNativePrimary = (native: number) => {
    if (usdMode) {
      if (solUsdRate == null) return '\u2014';
      return formatUsd(native * solUsdRate);
    }
    return `${formatNumber(native, { decimals: 4 })} ${nativeSym}`;
  };

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

  const spotReturnBuckets = useMemo(
    () => ({
      gt500: 0,
      pct200_500: 0,
      pct0_200: Math.floor(trades.length / 2),
      pct0_neg50: Math.floor(trades.length / 3),
      ltNeg50: Math.floor(trades.length / 6),
    }),
    [trades.length],
  );

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
        <Loader2 className="h-6 w-6 animate-spin text-accent-primary" />
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
    (authenticated && authSyncing && !backendReady && !authSyncError) ||
    (portfolioEnabled && query.isPending && query.fetchStatus === 'fetching' && !query.data);
  if (portfolioShowsLoadingSpinner) {
    return (
      <div className={cn('flex h-full min-h-[320px] items-center justify-center', className)}>
        <Loader2 className="h-6 w-6 animate-spin text-accent-primary" />
      </div>
    );
  }

  if (authenticated && !backendReady && authSyncError) {
    return (
      <div
        className={cn(
          'rounded border border-border-subtle bg-bg-raised p-3 text-[12px] text-signal-bear',
          className,
        )}
      >
        Account sync failed — portfolio needs your user profile in the database.
        <p className="mt-1 text-[11px] text-fg-muted">{authSyncError}</p>
        <button
          type="button"
          className="mt-2 text-[11px] font-semibold text-accent-primary hover:underline"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    );
  }

  if (portfolioEnabled && query.isError) {
    return (
      <div
        className={cn(
          'rounded border border-border-subtle bg-bg-raised p-3 text-[12px] text-signal-bear',
          className,
        )}
      >
        Could not load portfolio.
        {query.error instanceof Error && query.error.message ? (
          <p className="mt-1 text-[11px] text-fg-muted">{query.error.message}</p>
        ) : null}
        <button
          type="button"
          className="mt-2 text-[11px] font-semibold text-accent-primary hover:underline"
          onClick={() => void query.refetch()}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className={cn('flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden text-[12px] text-fg-primary', className)}>
      <div className="flex shrink-0 items-center gap-3 border-b border-border-subtle px-2 py-1">
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
              tab === id ? 'font-semibold text-fg-primary' : 'text-fg-muted hover:text-fg-secondary',
            )}
          >
            {label}
            {tab === id ? (
              <span className="absolute inset-x-0 -bottom-[1px] h-[2px] rounded-full bg-accent-primary" />
            ) : null}
          </button>
        ))}
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border-subtle px-2 py-2">
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
        <label
          className={cn(
            'flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border-subtle bg-bg-raised px-2 text-[10px] font-medium text-fg-muted transition hover:bg-bg-hover hover:text-fg-secondary',
            showHidden && 'border-accent-primary/35 text-fg-primary',
          )}
          title="Show archived / hidden wallets"
        >
          <input
            type="checkbox"
            checked={showHidden}
            onChange={(e) => setShowHidden(e.target.checked)}
            className="sr-only"
          />
          <EyeOff className="h-3.5 w-3.5 shrink-0 text-fg-muted" strokeWidth={2} />
          <span className="hidden sm:inline">Hidden</span>
        </label>
        <div className="min-w-2 flex-1" />
        <div className="flex h-8 min-w-[140px] max-w-[260px] flex-1 items-center gap-2 rounded-lg border border-border-subtle bg-bg-sunken px-3 transition focus-within:border-accent-primary/50 focus-within:outline-none focus-within:ring-1 focus-within:ring-accent-primary/20">
          <Search className="h-3.5 w-3.5 shrink-0 text-fg-muted" strokeWidth={2.2} />
          <input
            value={searchWallets}
            onChange={(e) => setSearchWallets(e.target.value)}
            placeholder="Search other wallets"
            className="min-w-0 flex-1 border-0 bg-transparent text-xs text-fg-primary outline-none placeholder:text-fg-muted"
          />
        </div>
        <button
          type="button"
          onClick={() => {
            if (activeChain !== 'sol') {
              toast.message('PNL tracker is available on Solana');
              return;
            }
            openPnlFromPortfolio({
              walletAddress: selectedWalletAddress,
              label: selectedDisplayName,
            });
          }}
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-bg-raised text-fg-muted transition',
            'hover:border-accent-primary/35 hover:bg-accent-primary/10 hover:text-accent-primary',
            pnlTrackerOpen && pnlPortfolioScope !== null && 'border-accent-primary/40 bg-accent-primary/10 text-accent-primary',
          )}
          aria-label="Open PNL tracker"
          title={`Open PNL tracker — ${selectedDisplayName}`}
        >
          <ImageUp className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
        <button
          type="button"
          onClick={() => setUsdMode((v) => !v)}
          className={cn(
            'h-8 shrink-0 rounded-lg border border-border-subtle bg-bg-sunken px-2.5 text-xs font-semibold tabular-nums transition hover:bg-bg-hover',
            usdMode ? 'text-fg-primary' : 'text-fg-secondary',
          )}
        >
          {usdMode ? 'USD' : nativeSym}
        </button>
        <div className="flex shrink-0 items-center gap-0.5">
          {(['1d', '7d', '30d', 'max'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setTimeFilter(f)}
              className={cn(
                'px-2 py-1 text-xs font-medium transition-colors',
                timeFilter === f
                  ? 'border-b-2 border-accent-primary font-semibold text-fg-primary'
                  : 'text-fg-muted hover:text-fg-secondary',
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {tab === 'trackers' ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-1 sm:p-2">
          <TrackersPanel className="min-h-0 flex-1" prefillWallet={prefillTrackerWallet} />
        </div>
      ) : (
        <div
          className={cn(
            'flex min-h-0 flex-1 flex-col',
            tab === 'wallets' ? 'overflow-hidden' : 'overflow-y-auto overscroll-contain',
          )}
        >
          {tab === 'spot' ? (
        <div className="flex flex-col gap-4 p-2 sm:p-3">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_2.5fr_1fr]">
            <div className="min-w-0 rounded-lg border border-border-subtle bg-bg-raised">
              <div className="flex flex-col gap-3 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-fg-primary">Balance</span>
                  <button
                    type="button"
                    onClick={() => setUsdMode((v) => !v)}
                    className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] font-medium uppercase tracking-wide text-fg-muted transition hover:bg-bg-hover hover:text-fg-primary"
                    title={`Switch to ${usdMode ? nativeSym : 'USD'}`}
                  >
                    {usdMode ? 'USD' : nativeSym}
                    <ArrowLeftRight className="h-2.5 w-2.5 shrink-0 opacity-70" strokeWidth={2.25} aria-hidden />
                  </button>
                </div>

                <div>
                  <p className="text-[10px] text-fg-muted">Total Value</p>
                  <p className="mt-0.5 font-sans text-2xl font-bold tabular-nums leading-none text-fg-primary">
                    {formatBalancePrimary(portfolio.summary.totalValueUsd, true)}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] text-fg-muted">Unrealized PNL</p>
                  <p
                    className={cn(
                      'mt-0.5 font-sans text-lg font-semibold tabular-nums leading-none',
                      (portfolio.summary.unrealizedPnlUsd ?? 0) > 0
                        ? 'text-signal-bull'
                        : (portfolio.summary.unrealizedPnlUsd ?? 0) < 0
                          ? 'text-signal-bear'
                          : 'text-fg-muted',
                    )}
                  >
                    {formatBalancePrimary(portfolio.summary.unrealizedPnlUsd)}
                  </p>
                </div>

                <div className="flex items-start justify-between gap-2 border-t border-border-subtle pt-2">
                  <div>
                    <p className="text-[10px] text-fg-muted">Tradeable Balance</p>
                    <p className="mt-0.5 font-sans text-sm font-semibold tabular-nums text-fg-primary">
                      {formatNativePrimary(selectedNativeUi)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-fg-muted">Wallets Funding</p>
                    <div className="mt-0.5 flex items-center justify-end gap-1.5">
                      <ChainIcon chain={activeChain} size={14} className="shrink-0 rounded-full" />
                      <span className="font-sans text-sm font-semibold tabular-nums text-fg-primary">
                        {formatNativePrimary(combinedNativeUi)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative min-w-0 rounded-lg border border-border-subtle bg-bg-raised">
              <div className="relative z-10 flex items-center justify-between px-4 pb-2 pt-4">
                <span className="text-xs font-semibold text-fg-primary">Realized PNL</span>
                <div className="pointer-events-auto relative z-10 flex items-center gap-2">
                  <span className="text-[10px] text-fg-muted">30d</span>
                  <button
                    type="button"
                    title="View PNL Calendar"
                    aria-label="View PNL Calendar"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      openPnlCalendar({
                        closedSells: closed.map((c) => ({
                          submittedAt: c.submittedAt,
                          realizedPnlUsd: c.realizedPnlUsd,
                          realizedPnlSol: c.solProceeds - c.costBasisSol,
                        })),
                        trades: trades.map((t) => ({
                          side: t.side,
                          submittedAt: t.submittedAt,
                          amountSol: t.amountSol,
                          status: t.status,
                        })),
                        solUsd: portfolio.solUsd,
                        usdMode,
                      });
                    }}
                    className="relative z-10 flex h-7 w-7 items-center justify-center rounded border border-border-subtle text-fg-muted transition hover:border-accent-primary/35 hover:bg-bg-hover hover:text-fg-primary"
                  >
                    <Calendar className="pointer-events-none h-3.5 w-3.5" strokeWidth={2} />
                  </button>
                </div>
              </div>
              <div className="px-4 pb-4">
                <TinyLineChart
                  positive={portfolio.summary.realizedPnlUsd >= 0}
                  empty={trades.length === 0 && positions.length === 0}
                />
              </div>
            </div>

            <div className="min-w-0 rounded-lg border border-border-subtle bg-bg-raised">
              <div className="flex flex-col gap-2 p-4">
                <span className="mb-1 text-xs font-semibold text-fg-primary">Performance</span>

                {[
                  {
                    label: '30d Total PNL',
                    value: portfolio.summary.totalPnlUsd,
                    neutral: false as const,
                  },
                  {
                    label: '30d Realized PNL',
                    value: portfolio.summary.realizedPnlUsd,
                    neutral: false as const,
                  },
                  {
                    label: '30d TXNS',
                    value: trades.length,
                    neutral: true as const,
                  },
                ].map((m) => (
                  <div key={m.label} className="flex items-center justify-between">
                    <span className="text-xs text-fg-muted">{m.label}</span>
                    <span
                      className={cn(
                        'text-xs font-semibold tabular-nums',
                        m.neutral
                          ? 'text-fg-primary'
                          : Number(m.value) > 0
                            ? 'text-signal-bull'
                            : Number(m.value) < 0
                              ? 'text-signal-bear'
                              : 'text-fg-muted',
                      )}
                    >
                      {m.neutral ? String(m.value) : formatUsd(Number(m.value))}
                    </span>
                  </div>
                ))}

                <div className="mt-3 border-t border-border-subtle pt-3">
                  <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-fg-muted">
                    Return Distribution
                  </p>
                  {[
                    { label: '>500%', count: spotReturnBuckets.gt500, dot: 'bg-signal-bull' },
                    {
                      label: '200% ~ 500%',
                      count: spotReturnBuckets.pct200_500,
                      dot: 'bg-signal-bull',
                    },
                    {
                      label: '0% ~ 200%',
                      count: spotReturnBuckets.pct0_200,
                      dot: 'bg-signal-bull/50',
                    },
                    {
                      label: '0% ~ -50%',
                      count: spotReturnBuckets.pct0_neg50,
                      dot: 'bg-signal-bear/50',
                    },
                    { label: '< -50%', count: spotReturnBuckets.ltNeg50, dot: 'bg-signal-bear' },
                  ].map((b) => (
                    <div key={b.label} className="mb-1.5 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className={cn('h-2 w-2 shrink-0 rounded-full', b.dot)} />
                        <span className="text-[11px] text-fg-muted">{b.label}</span>
                      </div>
                      <span className="text-xs font-semibold tabular-nums text-fg-primary">{b.count}</span>
                    </div>
                  ))}
                  <div className="mt-2 flex h-1 gap-px overflow-hidden rounded-full">
                    <div
                      className="h-full bg-signal-bull"
                      style={{ flex: spotReturnBuckets.gt500 || 1 }}
                    />
                    <div
                      className="h-full bg-signal-bull/70"
                      style={{ flex: spotReturnBuckets.pct200_500 || 1 }}
                    />
                    <div
                      className="h-full bg-signal-bull/40"
                      style={{ flex: spotReturnBuckets.pct0_200 || 1 }}
                    />
                    <div
                      className="h-full bg-signal-bear/40"
                      style={{ flex: spotReturnBuckets.pct0_neg50 || 1 }}
                    />
                    <div
                      className="h-full bg-signal-bear"
                      style={{ flex: spotReturnBuckets.ltNeg50 || 1 }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
            <section className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-border-subtle bg-bg-raised">
              <div className="flex flex-wrap items-center gap-4 border-b border-border-subtle px-4 py-2">
                <div className="flex flex-wrap items-center gap-4">
                  {([
                    ['active_positions', 'Active Positions'],
                    ['history', 'History'],
                    ['top100', 'Top 100'],
                  ] as const).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setSpotTableTab(id)}
                      className={cn(
                        'px-2 py-1 text-xs font-medium transition-colors',
                        spotTableTab === id
                          ? 'border-b-2 border-accent-primary font-semibold text-fg-primary'
                          : 'text-fg-muted hover:text-fg-secondary',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="ml-auto flex flex-wrap items-center gap-2">
                  <div className="flex h-8 min-w-[140px] items-center gap-2 rounded-lg border border-border-subtle bg-bg-sunken px-3 transition focus-within:border-accent-primary/50 focus-within:outline-none focus-within:ring-1 focus-within:ring-accent-primary/20">
                    <Search className="h-3.5 w-3.5 shrink-0 text-fg-muted" strokeWidth={2} />
                    <input
                      value={searchTable}
                      onChange={(e) => setSearchTable(e.target.value)}
                      placeholder="Search by name or address"
                      className="min-w-0 flex-1 border-0 bg-transparent text-xs text-fg-primary outline-none placeholder:text-fg-muted"
                    />
                  </div>
                  <label className="inline-flex cursor-pointer items-center gap-1.5 text-[10px] text-fg-muted">
                    <input
                      type="checkbox"
                      checked={showHidden}
                      onChange={(e) => setShowHidden(e.target.checked)}
                      className="h-3 w-3 rounded border-border-subtle"
                    />
                    Show Hidden
                  </label>
                  <button
                    type="button"
                    onClick={() => setUsdMode((v) => !v)}
                    className="h-8 rounded-lg border border-border-subtle bg-bg-sunken px-2 text-[10px] font-semibold tabular-nums text-fg-primary transition hover:bg-bg-hover"
                  >
                    {usdMode ? 'USD' : nativeSym}
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead className="sticky top-0 bg-bg-sunken">
                    <tr className="border-b border-border-subtle">
                      <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-fg-muted">
                        Token
                      </th>
                      <th className="px-4 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-fg-muted tabular-nums">
                        Bought
                      </th>
                      <th className="px-4 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-fg-muted tabular-nums">
                        Sold
                      </th>
                      <th className="px-4 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-fg-muted tabular-nums">
                        PnL
                      </th>
                      <th className="px-4 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-fg-muted">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row, i) => {
                      const mint = row.mint;
                      const symbol = row.symbol ?? shortenAddress(mint, 4);
                      const pnl = 'realizedPnlUsd' in row ? row.realizedPnlUsd : (row.unrealizedPnlUsd ?? 0);
                      const bought = 'costBasisSol' in row ? row.costBasisSol : 0;
                      const sold = 'solProceeds' in row ? row.solProceeds : 0;
                      const imgUrl = 'imageUrl' in row ? row.imageUrl : null;
                      const boughtSecondary =
                        'balanceRaw' in row ? tokenUiAmountFromRaw(row.balanceRaw, row.decimals) : '';
                      const soldSecondary =
                        'amountTokenRaw' in row ? tokenUiAmountFromRaw(row.amountTokenRaw, row.decimals) : '';
                      const pnlPct =
                        'unrealizedPnlUsd' in row &&
                        row.costBasisUsd > 0 &&
                        row.unrealizedPnlUsd != null
                          ? formatNumber((row.unrealizedPnlUsd / row.costBasisUsd) * 100, { decimals: 1 })
                          : null;
                      const boughtPrimary = usdMode ? formatUsd(bought) : `${formatNumber(bought, { decimals: 4 })} ${nativeSym}`;
                      const soldPrimary = usdMode ? formatUsd(sold) : `${formatNumber(sold, { decimals: 4 })} ${nativeSym}`;
                      const pnlPrimary =
                        usdMode ? formatUsd(pnl) : `${formatNumber((pnl ?? 0) / Math.max(1, portfolio.solUsd ?? 150), { decimals: 4 })} ${nativeSym}`;
                      return (
                        <tr
                          key={`${mint}-${i}`}
                          className="h-12 border-b border-border-subtle transition-colors hover:bg-bg-hover"
                        >
                          <td className="px-4 align-middle">
                            <div className="flex items-center gap-2">
                              {imgUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  alt=""
                                  src={imgUrl}
                                  className="h-8 w-8 shrink-0 rounded-lg object-cover ring-1 ring-border-subtle"
                                />
                              ) : (
                                <span className="h-8 w-8 shrink-0 rounded-lg bg-bg-sunken ring-1 ring-border-subtle" />
                              )}
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-fg-primary">{symbol}</div>
                                <div className="truncate text-xs text-fg-muted">{shortenAddress(mint, 8)}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 align-middle text-right">
                            <div className="flex flex-col items-end gap-0.5">
                              <span className="text-xs font-semibold tabular-nums text-signal-bull">{boughtPrimary}</span>
                              {boughtSecondary ? (
                                <span className="font-mono text-[10px] tabular-nums text-fg-muted">
                                  {boughtSecondary} {symbol}
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-4 align-middle text-right">
                            <div className="flex flex-col items-end gap-0.5">
                              <span className="text-xs font-semibold tabular-nums text-signal-bear">{soldPrimary}</span>
                              {soldSecondary ? (
                                <span className="font-mono text-[10px] tabular-nums text-fg-muted">
                                  {soldSecondary} {symbol}
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-4 align-middle text-right">
                            <div className="flex flex-col items-end gap-0.5">
                              <span
                                className={cn(
                                  'text-xs font-semibold tabular-nums',
                                  pnl >= 0 ? 'text-signal-bull' : 'text-signal-bear',
                                )}
                              >
                                {pnlPrimary}
                              </span>
                              {pnlPct != null ? (
                                <span className="text-[10px] tabular-nums text-fg-muted">({pnlPct}%)</span>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-4 align-middle text-right">
                            <div className="inline-flex items-center gap-1 text-fg-muted">
                              <button
                                type="button"
                                onClick={() => {
                                  void navigator.clipboard.writeText(mint);
                                  toast.success('Token address copied');
                                }}
                                className="rounded p-1 transition-colors hover:bg-bg-hover hover:text-fg-primary"
                                title="Copy token address"
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </button>
                              <Link
                                href={`/token/${mint}`}
                                className="rounded p-1 transition-colors hover:bg-bg-hover hover:text-fg-primary"
                                title="Open token"
                              >
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

            <section className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-border-subtle bg-bg-raised">
              <div className="flex items-center gap-3 border-b border-border-subtle px-4 py-2">
                <button
                  type="button"
                  onClick={() => setSpotActivityTab('activity')}
                  className={cn(
                    'px-2 py-1 text-xs font-medium transition-colors',
                    spotActivityTab === 'activity'
                      ? 'border-b-2 border-accent-primary font-semibold text-fg-primary'
                      : 'text-fg-muted hover:text-fg-secondary',
                  )}
                >
                  Activity
                </button>
                <button
                  type="button"
                  onClick={() => setSpotActivityTab('transfers')}
                  className={cn(
                    'px-2 py-1 text-xs font-medium transition-colors',
                    spotActivityTab === 'transfers'
                      ? 'border-b-2 border-accent-primary font-semibold text-fg-primary'
                      : 'text-fg-muted hover:text-fg-secondary',
                  )}
                >
                  Transfers
                </button>
              </div>
              <div className="px-2 pb-3 pt-2 sm:px-3">
                {spotActivityTab === 'activity' ? (
                  trades.length > 0 ? (
                    <table className="w-full table-fixed border-separate border-spacing-0 text-left text-[11px]">
                      <thead className="sticky top-0 z-[1] bg-bg-sunken">
                        <tr className="border-b border-border-subtle">
                          <th scope="col" className="w-[4.5rem] whitespace-nowrap px-2 py-2.5 text-left text-[10px] font-semibold tracking-tight text-fg-muted">
                            Type
                          </th>
                          <th scope="col" className="min-w-0 px-2 py-2.5 text-left text-[10px] font-semibold tracking-tight text-fg-muted">
                            Token
                          </th>
                          <th scope="col" className="w-[5.75rem] whitespace-nowrap px-2 py-2.5 text-right text-[10px] font-semibold tracking-tight tabular-nums text-fg-muted sm:w-[28%]">
                            Amount
                          </th>
                          <th scope="col" className="hidden px-2 py-2.5 text-right text-[10px] font-semibold tracking-tight text-fg-muted sm:table-cell md:w-[20%]">
                            M.Cap
                          </th>
                          <th scope="col" className="min-w-[3.75rem] px-2 py-2.5 pr-4 text-right text-[10px] font-semibold tracking-tight tabular-nums text-fg-muted sm:min-w-0 md:w-[16%]">
                            Age
                          </th>
                          <th scope="col" className="w-[2.875rem] px-2 py-2.5 text-center text-[10px] font-semibold tracking-tight text-fg-muted" title="Explorer">
                            <ExternalLink className="mx-auto h-3 w-3 opacity-60" aria-hidden />
                            <span className="sr-only">Explorer</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {trades.map((t) => (
                          <tr
                            key={t.id}
                            className="border-b border-border-subtle transition-colors hover:bg-bg-hover"
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
                            <td className="min-w-0 px-2 py-2.5 align-middle text-[11px] font-medium leading-snug text-fg-secondary">
                              <div className="flex min-w-0 items-center gap-0.5 sm:gap-1">
                                <span className="min-w-0 flex-1 truncate" title={t.mint}>
                                  {shortenAddress(t.mint, 4)}
                                </span>
                                <a
                                  href={xLiveSearchContractUrl(t.mint)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="shrink-0 rounded-md p-1.5 text-fg-muted hover:bg-bg-hover hover:text-accent-primary"
                                  aria-label="Search contract on X"
                                  title="Search contract on X"
                                >
                                  <Search className="h-4 w-4 sm:h-3.5 sm:w-3.5" strokeWidth={2.2} aria-hidden />
                                </a>
                              </div>
                            </td>
                            <td className="px-2 py-2.5 text-right align-middle text-[11px] font-medium tabular-nums tracking-normal text-fg-primary">
                              {t.amountSol != null ? (
                                formatNumber(t.amountSol, { decimals: 3 })
                              ) : (
                                <span className="text-[13px] font-normal tabular-nums text-fg-muted">—</span>
                              )}
                            </td>
                            <td className="hidden px-2 py-2.5 text-right align-middle tabular-nums text-[11px] sm:table-cell">
                              <span className="inline-block tabular-nums text-[13px] text-fg-muted">—</span>
                            </td>
                            <td className="px-2 py-2.5 pr-3 text-right align-middle tabular-nums text-[11px] text-fg-muted">
                              {formatRelativeTime(t.submittedAt)}
                            </td>
                            <td className="px-1.5 py-2 text-center align-middle sm:px-2">
                              <a
                                href={explorerUrlSolanaTx(t.txSignature)}
                                target="_blank"
                                rel="noreferrer"
                                className="mx-auto inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-bg-hover hover:text-accent-primary"
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
                    <div className="flex flex-col items-center justify-center py-12">
                      <div className="relative mb-2 h-8 w-8">
                        <Activity className="h-8 w-8 text-fg-muted" strokeWidth={1.75} />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="h-px w-8 rotate-45 bg-fg-muted" />
                        </div>
                      </div>
                      <p className="text-sm text-fg-secondary">No activity</p>
                    </div>
                  )
                ) : (
                  <div className="flex flex-col items-center justify-center py-12">
                    <p className="text-sm text-fg-secondary">No transfers</p>
                    <p className="mt-1 text-xs text-fg-muted">Incoming and outgoing transfers will show here.</p>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      ) : null}

      {tab === 'wallets' ? (
        <div className="grid min-h-0 flex-1 grid-cols-12 gap-2 overflow-hidden p-2 md:gap-3 md:p-3">
          <section className="col-span-12 flex min-h-0 flex-col overflow-hidden rounded-xl border border-border-subtle bg-bg-raised md:col-span-6">
            <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border-subtle px-3 py-2">
              <div
                className={cn(
                  'flex min-w-[140px] flex-1 items-center gap-2 rounded-lg border px-2.5 py-1.5 transition focus-within:border-border-default focus-within:ring-1 focus-within:ring-accent-primary/25',
                  OS.borderSoft,
                  'bg-bg-sunken',
                )}
              >
                <Search className="h-3.5 w-3.5 shrink-0 text-fg-muted" strokeWidth={2.2} />
                <input
                  value={searchWallets}
                  onChange={(e) => setSearchWallets(e.target.value)}
                  placeholder="Search by name or address…"
                  className="min-w-0 flex-1 border-0 bg-transparent text-[11px] text-fg-primary outline-none placeholder:text-fg-muted"
                />
              </div>
              <button
                type="button"
                onClick={() => setShowHidden((v) => !v)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg border border-border-subtle bg-bg-sunken px-2.5 py-1.5 text-[10px] font-medium text-fg-secondary transition hover:bg-bg-hover hover:text-fg-primary',
                  showHidden && 'border-accent-primary/35 text-fg-primary',
                )}
              >
                {showHidden ? <EyeOff className="h-3.5 w-3.5" strokeWidth={2} /> : <Eye className="h-3.5 w-3.5" strokeWidth={2} />}
                {showHidden ? 'Hide archived' : 'Show archived'}
              </button>
              <button
                type="button"
                onClick={() => setImportOpen(true)}
                className={cn(
                  'rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold text-fg-secondary transition hover:border-border-default hover:bg-bg-hover hover:text-fg-primary',
                  OS.borderSoft,
                  'bg-bg-sunken',
                )}
              >
                Import
              </button>
              <div className="relative ml-auto">
                <button
                  type="button"
                  onClick={() => setCreateMenuOpen((v) => !v)}
                  disabled={creating}
                  className="inline-flex items-center gap-1 rounded-lg bg-accent-primary px-2.5 py-1.5 text-[10px] font-semibold text-fg-inverse transition hover:brightness-110 disabled:opacity-50"
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
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[11px] font-semibold text-fg-primary transition hover:bg-bg-hover"
                    >
                      <Wallet className="h-3.5 w-3.5 opacity-90" /> Wallet
                    </button>
                  </div>
                ) : null}
              </div>
            </div>

            <WalletGroupsSidebar
              wallets={activeWallets}
              selectedGroupId={selectedWalletGroupId}
              onSelectGroup={setSelectedWalletGroupId}
            />

            <div className="flex shrink-0 items-center gap-3 border-b border-border-subtle/80 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-fg-muted">
              <span className="min-w-0 flex-1">Wallet</span>
              <span className="flex shrink-0 items-center gap-6 pr-[5.5rem]">
                <span className="min-w-[4.5rem] text-right">Balance</span>
                <span className="min-w-[2.5rem] text-right">Holdings</span>
              </span>
            </div>

            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-2 py-1.5 [scrollbar-width:thin]">
              {walletRows.map((w) => {
                const trading = activeTradingAddress === w.wallet_address;
                return (
                  <PortfolioWalletTableRow
                    key={w.id}
                    wallet={w}
                    activeChain={activeChain}
                    trading={trading}
                    selected={selectedPortfolioWalletId === w.id}
                    balanceSol={balanceLamportsToSol(w.balance_lamports)}
                    holdingsCount={0}
                    onSelect={() => {
                      setSelectedPortfolioWalletId(w.id);
                      setFunderWalletId(w.id);
                    }}
                    onOpenAnalytics={() => openWalletAnalytics(w.wallet_address)}
                    onSaveLabel={(label) => saveWalletLabel(w.id, label)}
                    onArchive={() => void archiveWallet(w.id, w.is_archived)}
                    onExportKey={() => onExportWalletKey(w)}
                    explorerUrl={explorerAccountUrlForChain(w.wallet_address, activeChain)}
                  />
                );
              })}

              {walletRows.length === 0 ? (
                <div
                  className={cn(
                    'flex min-h-[120px] flex-col items-center justify-center rounded-lg border border-dashed px-4 py-8 text-center',
                    OS.borderSoft,
                  )}
                >
                  <Wallet className="mb-2 h-7 w-7 text-fg-muted" strokeWidth={1.5} />
                  <p className="text-[12px] font-medium text-fg-secondary">
                    {showHidden ? 'No archived wallets' : `No wallets on ${nativeSym}`}
                  </p>
                  <p className="mt-1 max-w-[240px] text-[11px] leading-relaxed text-fg-muted">
                    {showHidden
                      ? 'Archived wallets appear here when you archive them from the list.'
                      : 'Import an external wallet or create one to get started.'}
                  </p>
                </div>
              ) : null}
            </div>
          </section>

          <section className="col-span-12 flex min-h-0 flex-col overflow-hidden rounded-xl border border-border-subtle bg-bg-raised md:col-span-6">
            <div className="border-b border-border-subtle bg-bg-base/40 px-3 py-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-fg-secondary">Capital routing</h3>
                  <p className="mt-0.5 text-[10px] text-fg-muted">Source a balance, fan out to receivers, preview the split.</p>
                </div>
                <span className="rounded-full border border-border-subtle bg-bg-sunken px-2.5 py-1 text-[10px] font-medium tabular-nums text-fg-secondary">
                  {funderWallet ? '1 source' : '0 sources'} · {receiverWallets.length} rcv
                </span>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-2.5">
              <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4">
                <SummaryTile label="Wallets" value={String(visibleWallets.length)} />
                <SummaryTile label="Total" value={formatNumber(combinedNativeUi, { decimals: 3 })} />
                <SummaryTile label="Active" value={String(visibleWallets.filter((x) => x.is_active).length)} />
                <SummaryTile label="Receivers" value={String(receiverWallets.length)} />
              </div>

              <div className={cn('shrink-0 rounded-lg border border-border-subtle bg-bg-sunken p-2.5', OS.borderSoft)}>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-fg-muted">01 — Source</p>
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

              <div className={cn('flex min-h-0 flex-1 flex-col rounded-lg border border-border-subtle bg-bg-sunken p-2.5', OS.borderSoft)}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-fg-muted">02 — Receivers</p>
                    <p className="mt-0.5 text-[10px] text-fg-muted">Equal split · tap to toggle</p>
                  </div>
                  <span className="rounded-md border border-border-subtle bg-bg-base px-2 py-0.5 text-[10px] font-medium tabular-nums text-fg-secondary">
                    {receiverWallets.length} selected
                  </span>
                </div>
                <div className="mt-2 min-h-0 flex-1 grid gap-1 overflow-y-auto overscroll-contain sm:grid-cols-2 [scrollbar-width:thin]">
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
                            ? 'border-accent-primary/40 bg-accent-primary/10 shadow-[inset_3px_0_0_0_rgb(var(--accent-primary-rgb))]'
                            : 'border-border-subtle bg-bg-base hover:border-border-default hover:bg-bg-hover',
                        )}
                      >
                        <WalletMonogram address={w.wallet_address} label={w.label} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold text-fg-primary">
                            {w.label?.trim() || shortenAddress(w.wallet_address, 4)}
                          </span>
                          <span className="block truncate tabular-nums tracking-tight text-[10px] text-fg-muted">
                            {shortenAddress(w.wallet_address, 5)}
                            {disabled ? ' · source' : ''}
                          </span>
                        </span>
                        <span
                          className={cn(
                            'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition',
                            checked
                              ? 'border-accent-primary bg-accent-primary text-fg-inverse'
                              : 'border-border-default bg-transparent',
                          )}
                        >
                          {checked ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-end">
                <div
                  className={cn(
                    'rounded-xl border border-border-subtle bg-bg-sunken px-3 py-2.5 focus-within:ring-1 focus-within:ring-accent-primary/30',
                    OS.borderSoft,
                  )}
                >
                  <label className="text-[10px] font-bold uppercase tracking-[0.14em] text-fg-muted">
                    Total to route ({nativeSym})
                  </label>
                  <input
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    placeholder={nativeSym === 'SOL' ? '0.00' : '0'}
                    inputMode="decimal"
                    className="mt-1 w-full border-0 bg-transparent py-0.5 text-[20px] font-semibold tabular-nums tracking-tight text-fg-primary outline-none placeholder:text-fg-muted"
                  />
                  <p className="mt-1 text-[10px] text-fg-muted">
                    Execution preview only — confirms split math before handoff.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!funderWallet || receiverWallets.length === 0) return;
                    if (activeChain !== 'sol') {
                      toast.message('Private transfer is available on Solana');
                      return;
                    }
                    setPrivateTransferOpen(true);
                  }}
                  disabled={!funderWallet || receiverWallets.length === 0}
                  className="h-11 min-w-[132px] rounded-xl border border-border-subtle bg-bg-sunken px-4 text-[11px] font-bold text-fg-secondary transition hover:border-accent-primary/35 hover:bg-accent-primary/10 hover:text-fg-primary disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Private Transfer
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (funderWallet && receiverWallets.length > 0 && transferAmount.trim()) setTransferOpen(true);
                  }}
                  disabled={!funderWallet || receiverWallets.length === 0 || !transferAmount.trim()}
                  className="h-11 min-w-[132px] rounded-xl bg-accent-primary px-4 text-[11px] font-bold text-fg-inverse transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                  title={!funderWallet || receiverWallets.length === 0 ? 'Select one funder and at least one receiver' : undefined}
                >
                  Start Transfer
                </button>
              </div>

              <div className="rounded-xl border border-emerald-500/20 bg-bg-sunken/50 px-3 py-2.5 text-[11px] leading-relaxed text-fg-secondary">
                <span className="font-semibold text-emerald-200/90">Split preview ·</span> one source sends the full amount; it is divided evenly across every selected
                receiver.
                {receiverWallets.length > 0 && transferAmount.trim() ? (
                  <span className="mt-1 block text-accent-glow">
                    Each receiver ≈{' '}
                    <span className="font-semibold tabular-nums text-accent-glow">
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
        </div>
      )}

      <div className="flex shrink-0 items-center justify-between border-t border-border-subtle px-2 py-1 text-[10px] text-fg-muted">
        <div className="flex items-center gap-2">
          <span>BTC</span>
          <span className="tabular-nums text-fg-primary">{btc?.usdPrice != null ? `$${formatNumber(btc.usdPrice, { decimals: 2 })}` : '—'}</span>
          <span className={cn('tabular-nums', (btc?.priceChange24h ?? 0) >= 0 ? 'text-signal-bull' : 'text-signal-bear')}>
            {btc?.priceChange24h != null ? `${btc.priceChange24h >= 0 ? '+' : ''}${formatNumber(btc.priceChange24h, { decimals: 2 })}%` : '—'}
          </span>
        </div>
        <div className="flex items-center gap-2">
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

      {privateTransferOpen && funderWallet && receiverWallets.length > 0 ? (
        <PrivateTransferProviderModal
          visible={privateTransferOpen && !splitNowOpen}
          sourceLabel={funderWallet.label?.trim() || shortenAddress(funderWallet.wallet_address, 4)}
          receiverLabel={
            receiverWallets.length === 1
              ? receiverWallets[0]!.label?.trim() || shortenAddress(receiverWallets[0]!.wallet_address, 4)
              : `${receiverWallets.length} wallets`
          }
          onClose={() => setPrivateTransferOpen(false)}
          onSelect={(provider: PrivateTransferProvider) => {
            if (provider === 'splitnow') {
              setSplitNowOpen(true);
              return;
            }
            toast.message('Coming soon');
          }}
        />
      ) : null}

      {splitNowOpen && funderWallet && receiverWallets.length > 0 ? (
        <SplitNowTransferModal
          visible={splitNowOpen}
          source={funderWallet}
          receivers={receiverWallets}
          nativeSym={nativeSym}
          onClose={() => {
            setSplitNowOpen(false);
            setPrivateTransferOpen(false);
          }}
          onBack={() => setSplitNowOpen(false)}
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
          'relative w-full max-w-[360px] rounded border border-border-subtle bg-bg-raised shadow-2xl fill-mode-forwards',
          overlayPanelClasses(motionVisible),
        )}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border-subtle px-3 py-3">
          <h2 className="text-[13px] font-semibold text-fg-primary">
            Split from {source.label?.trim() || 'wallet'} to {receivers.length} wallet{receivers.length === 1 ? '' : 's'}
          </h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-fg-muted hover:text-fg-primary">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3 p-3">
          <div className="flex w-full items-center justify-between rounded border border-border-subtle bg-bg-sunken px-3 py-2 text-[11px] font-semibold text-fg-secondary">
            <span className="inline-flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm bg-accent-primary" />
              {nativeSym}
            </span>
            <span className="text-[10px] text-fg-muted">Native asset</span>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-fg-muted">Amount</label>
            <div className="flex gap-2">
              <div className="flex min-w-0 flex-1 items-center rounded border border-border-subtle bg-bg-sunken px-2">
                <input
                  value={amount}
                  onChange={(e) => onAmountChange(e.target.value)}
                  placeholder="Enter amount"
                  inputMode="decimal"
                  className="min-w-0 flex-1 border-0 bg-transparent py-2 text-[12px] text-fg-primary outline-none placeholder:text-fg-muted"
                />
                <span className="h-3 w-3 rounded-sm bg-accent-primary" />
              </div>
              <div className="flex w-14 items-center justify-center rounded border border-border-subtle bg-bg-sunken text-[11px] text-fg-muted">
                0.0 %
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <div className="relative h-1 rounded-full bg-bg-sunken">
              <div className="absolute left-0 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-accent-primary" />
            </div>
            <div className="flex justify-between text-[10px] text-fg-muted">
              <span>0%</span>
              <span>25%</span>
              <span>50%</span>
              <span>75%</span>
              <span>100%</span>
            </div>
          </div>

          <div className="text-[11px] text-fg-muted">
            Available:{' '}
            <span className="tabular-nums text-fg-primary">
              {formatNumber(available, { decimals: 5 })} {nativeSym}
            </span>
          </div>
          <div className="rounded-md border border-border-subtle bg-bg-sunken px-2 py-2 text-[11px] text-fg-muted">
            <div className="flex justify-between">
              <span>Receivers</span>
              <span className="tabular-nums text-fg-primary">{receivers.length}</span>
            </div>
            <div className="flex justify-between">
              <span>Equal split</span>
              <span className="tabular-nums text-accent-glow">{formatNumber(perReceiver || 0, { decimals: 5 })} {nativeSym}</span>
            </div>
          </div>
        </div>
        <div className="border-t border-border-subtle p-3">
          <button
            type="button"
            onClick={onSubmit}
            disabled={!amount.trim()}
            className="w-full rounded-full bg-accent-primary py-2 text-[12px] font-semibold text-fg-inverse disabled:opacity-45"
          >
            Confirm Preview
          </button>
        </div>
      </div>
    </div>
  );
}

function TinyLineChart({ positive = true, empty = false }: { positive?: boolean; empty?: boolean }) {
  const lineColor = positive ? '#3DDC97' : '#FF5E78';
  const w = 320;
  const h = 96;
  const baseline = 48;
  const bottom = h - 8;
  const pts: [number, number][] = positive
    ? [
        [0, 58],
        [64, 52],
        [128, 46],
        [192, 40],
        [256, 34],
        [320, 30],
      ]
    : [
        [0, 34],
        [64, 40],
        [128, 46],
        [192, 52],
        [256, 56],
        [320, 60],
      ];
  const linePath = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ');
  const fillPath = `${linePath} L ${w} ${bottom} L 0 ${bottom} Z`;

  return (
    <div className="relative h-[96px] w-full overflow-hidden rounded-lg border border-border-subtle bg-bg-sunken">
      {empty ? (
        <div className="flex h-full flex-col items-center justify-center px-4 text-center">
          <p className="text-xs font-semibold text-fg-secondary">No PNL history yet</p>
          <p className="mt-1 text-[10px] text-fg-muted">
            Trades will appear here once this wallet has activity.
          </p>
        </div>
      ) : (
        <svg className="h-full w-full" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
          <defs>
            <linearGradient id="spotPnlAbove" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3DDC97" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3DDC97" stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="spotPnlBelow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#FF5E78" stopOpacity={0.05} />
              <stop offset="95%" stopColor="#FF5E78" stopOpacity={0.3} />
            </linearGradient>
          </defs>
          <path
            d={fillPath}
            fill={positive ? 'url(#spotPnlAbove)' : 'url(#spotPnlBelow)'}
            opacity={0.9}
          />
          <line
            x1={0}
            y1={baseline}
            x2={w}
            y2={baseline}
            stroke="rgba(255,255,255,0.08)"
            strokeDasharray="3 3"
            strokeWidth={1}
          />
          <path
            d={linePath}
            fill="none"
            stroke={lineColor}
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      )}
    </div>
  );
}

function PortfolioPlaceholderRows() {
  return (
    <tr>
      <td colSpan={5} className="px-4 py-12">
        <div className="flex flex-col items-center justify-center">
          <Wallet className="mb-2 h-6 w-6 text-fg-muted" strokeWidth={1.75} />
          <p className="text-sm text-fg-secondary">No active positions</p>
          <p className="mt-1 text-xs text-fg-muted">Positions will appear after trades are detected</p>
        </div>
      </td>
    </tr>
  );
}

function SummaryTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-md border border-border-subtle bg-bg-sunken px-2 py-2">
      <div className="text-[10px] text-fg-muted">{label}</div>
      <div className="mt-0.5 truncate text-[12px] font-semibold tabular-nums text-fg-primary">
        {value}
        {sub ? <span className="ml-1 text-[10px] font-medium text-fg-muted">{sub}</span> : null}
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
            className="h-full rounded-full bg-accent-primary shadow-[0_0_12px_-3px_rgb(var(--accent-primary-rgb)/0.45)]"
            style={{ width: `${Math.max(0, Math.min(100, bar))}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}
