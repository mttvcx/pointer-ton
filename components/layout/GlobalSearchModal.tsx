'use client';

import { ProtocolBrandIcon } from '@/components/tokens/ProtocolBrandIcon';
import { SearchQuickBuySettingsPanel } from '@/components/layout/SearchQuickBuySettingsPanel';
import { SearchTokenRow } from '@/components/layout/SearchTokenRow';
import {
  BadgeCheck,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  Clock,
  Coins,
  GraduationCap,
  LayoutList,
  LineChart,
  Loader2,
  Droplets,
  Search,
  Printer,
  Settings,
  Shield,
  Crown,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { toast } from 'sonner';
import { CHAIN_DROPDOWN_LABEL } from '@/lib/chains/chainAssets';
import { mintMatchesAppChain } from '@/lib/chains/mintKind';
import { isValidGlobalSearchQuery } from '@/lib/ethereum/EthereumSearch';
import {
  buildSearchPathForQuery,
  searchQueryMatchesActiveChain,
} from '@/lib/search/resolveSearchPath';
import {
  TON_DEMO_JETTON_A,
  TON_DEMO_JETTON_B,
  TON_NATIVE_UI_MINT,
} from '@/lib/utils/tonDemoMints';
import { cn } from '@/lib/utils/cn';
import { useUiDemoMode } from '@/lib/hooks/useUiDemoMode';
import { useOverlayPresence } from '@/lib/hooks/useOverlayPresence';
import { overlayBackdropClasses, overlayPanelFromTopClasses } from '@/lib/ui/overlayMotion';
import {
  searchModalChipIdleClass,
  searchModalIconBtnClass,
  searchModalInputShellClass,
  searchModalPanelClass,
} from '@/lib/ui/searchModalChrome';
import { useRecentTradeMintsStore } from '@/store/recentTradeMints';
import { useSearchModalPrefsStore } from '@/store/searchModalPrefs';
import { useUIStore } from '@/store/ui';

const PROTOCOL_IDS = ['pump', 'bonk', 'printr', 'og_mode', 'graduated', 'dex_paid'] as const;
type ProtocolId = (typeof PROTOCOL_IDS)[number];

const PROTOCOL_CHIPS: {
  id: ProtocolId;
  label: string;
  Icon: ComponentType<{ className?: string }>;
  protocolLogo?: string;
  activeClass: string;
  idleClass: string;
}[] = [
  { id: 'pump', label: 'Pump', Icon: Coins, activeClass: 'bg-emerald-500/14 text-emerald-300', idleClass: searchModalChipIdleClass },
  { id: 'bonk', label: 'Bonk', Icon: Coins, protocolLogo: 'bonk', activeClass: 'bg-orange-500/14 text-orange-300', idleClass: searchModalChipIdleClass },
  { id: 'printr', label: 'Printr', Icon: Printer, protocolLogo: 'printr', activeClass: 'bg-sky-500/14 text-sky-300', idleClass: searchModalChipIdleClass },
  { id: 'og_mode', label: 'OG Mode', Icon: Crown, activeClass: 'bg-violet-500/14 text-violet-300', idleClass: searchModalChipIdleClass },
  { id: 'graduated', label: 'Graduated', Icon: GraduationCap, activeClass: 'bg-amber-500/14 text-amber-200', idleClass: searchModalChipIdleClass },
  { id: 'dex_paid', label: 'Dex Paid', Icon: BadgeCheck, activeClass: 'bg-cyan-500/14 text-cyan-300', idleClass: searchModalChipIdleClass },
];

const PROTOCOL_LAUNCHPAD_LABEL: Record<ProtocolId, string> = {
  pump: 'TON launchpad',
  bonk: 'Bonk Launch',
  printr: 'Printr',
  og_mode: 'OG Mode',
  graduated: 'Graduated',
  dex_paid: 'Dex Paid',
};

const MAX_RECENT = 20;

type SortMode = 'relevance' | 'time' | 'chart' | 'volume' | 'liquidity' | 'safety';

const SORT_TOOLS: { id: SortMode; label: string; Icon: ComponentType<{ className?: string }> }[] = [
  { id: 'relevance', label: 'Relevance', Icon: CheckCircle2 },
  { id: 'time', label: 'Age', Icon: Clock },
  { id: 'chart', label: 'Chart', Icon: LineChart },
  { id: 'volume', label: 'Volume', Icon: BarChart3 },
  { id: 'liquidity', label: 'Liquidity', Icon: Droplets },
  { id: 'safety', label: 'Safety', Icon: Shield },
];

type SummaryRow = {
  mint: string;
  symbol: string | null;
  name: string | null;
  image_url: string | null;
};

type EnrichedSummary = SummaryRow & {
  mockMc: number;
  mockVol: number;
  mockLiq: number;
  mockAgeMs: number;
  mockSafety: number;
  protocol: ProtocolId;
  dexLabel: string;
};

const DEMO_SEARCH_RECENTS: SummaryRow[] = [
  { mint: TON_NATIVE_UI_MINT, symbol: 'TON', name: 'Toncoin', image_url: null },
  { mint: TON_DEMO_JETTON_A, symbol: 'USD₮', name: 'Tether USD', image_url: null },
  { mint: TON_DEMO_JETTON_B, symbol: 'ADDR', name: 'Demo address', image_url: null },
];

function fnv1aHex(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function enrichSummary(row: SummaryRow): EnrichedSummary {
  const h = fnv1aHex(row.mint);
  const protocol = PROTOCOL_IDS[h % PROTOCOL_IDS.length]!;
  const mockSafety = (h >>> 20) % 101;
  const mockMc = 2_500 + (h % 998_500);
  const mockVol = (h >>> 8) % 420_000;
  const mockLiq = 1_200 + ((h >>> 16) % 520_000);
  const mockAgeMs = ((h >>> 4) % 21) * 86_400_000 + ((h >>> 12) % 12) * 3_600_000;
  return {
    ...row,
    mockMc,
    mockVol,
    mockLiq,
    mockAgeMs,
    mockSafety,
    protocol,
    dexLabel: PROTOCOL_LAUNCHPAD_LABEL[protocol],
  };
}

type LiveSearchMetrics = { mc: number; vol: number; liq: number };

function enrichSummaryWithLive(row: SummaryRow, live: LiveSearchMetrics | null): EnrichedSummary {
  const base = enrichSummary(row);
  if (!live) return base;
  return {
    ...base,
    mockMc: live.mc > 0 ? live.mc : base.mockMc,
    mockVol: live.vol > 0 ? live.vol : base.mockVol,
    mockLiq: live.liq > 0 ? live.liq : base.mockLiq,
    dexLabel: 'DexScreener',
  };
}

function sortEnrichedRows(rows: EnrichedSummary[], sortMode: SortMode): EnrichedSummary[] {
  const copy = [...rows];
  switch (sortMode) {
    case 'time':
      return copy.sort((a, b) => a.mockAgeMs - b.mockAgeMs);
    case 'volume':
      return copy.sort((a, b) => b.mockVol - a.mockVol);
    case 'liquidity':
      return copy.sort((a, b) => b.mockLiq - a.mockLiq);
    case 'chart':
      return copy.sort((a, b) => b.mockMc - a.mockMc);
    case 'safety':
      return copy.sort((a, b) => b.mockSafety - a.mockSafety);
    default:
      return copy;
  }
}

function filterSearchByProtocols(
  rows: EnrichedSummary[],
  activeProtocols: Set<ProtocolId>,
): EnrichedSummary[] {
  if (activeProtocols.size === 0) return rows;
  return rows.filter((r) => activeProtocols.has(r.protocol));
}

/**
 * Command-palette style search: mint / wallet resolve, recent mints, Esc to close.
 */
export function GlobalSearchModal() {
  const router = useRouter();
  const open = useUIStore((s) => s.searchOpen);
  const setOpen = useUIStore((s) => s.setSearchOpen);
  const searchQuery = useUIStore((s) => s.searchQuery);
  const setSearchQuery = useUIStore((s) => s.setSearchQuery);
  const activeChain = useUIStore((s) => s.activeChain);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const densityWrapRef = useRef<HTMLDivElement | null>(null);
  const [busy, setBusy] = useState(false);
  const uiDemo = useUiDemoMode();
  const { mounted: overlayMounted, visible } = useOverlayPresence(open);

  /** Active protocol filters: empty set = show all tokens. Non-empty = keep rows matching any selected protocol. */
  const [activeProtocols, setActiveProtocols] = useState<Set<ProtocolId>>(() => new Set());
  const [sortMode, setSortMode] = useState<SortMode>('relevance');
  /** Row vertical density toggled via list icon. */
  const [compactRows, setCompactRows] = useState(false);
  const [densityMenuOpen, setDensityMenuOpen] = useState(false);
  const [quickBuySettingsOpen, setQuickBuySettingsOpen] = useState(false);

  const quickBuySize = useSearchModalPrefsStore((s) => s.quickBuySize);
  const quickBuyChrome = useSearchModalPrefsStore((s) => s.quickBuyChrome);
  const quickBuyAmount = useSearchModalPrefsStore((s) => s.quickBuyAmountSol);

  const recents = useRecentTradeMintsStore((s) => s.mints);
  const recentsSlice = useMemo(
    () => recents.filter((m) => mintMatchesAppChain(m, activeChain)).slice(0, MAX_RECENT),
    [recents, activeChain],
  );

  const trimmedQuery = searchQuery.trim();
  const queryLooksLikeCa =
    trimmedQuery.length >= 32 && mintMatchesAppChain(trimmedQuery, activeChain);

  const previewQ = useQuery({
    queryKey: ['search-preview', activeChain, trimmedQuery],
    queryFn: async () => {
      const r = await fetch(
        `/api/search/preview?q=${encodeURIComponent(trimmedQuery)}&chain=${encodeURIComponent(activeChain)}`,
      );
      if (!r.ok) return { token: null };
      return r.json() as Promise<{
        token: {
          mint: string;
          symbol: string | null;
          name: string | null;
          image_url: string | null;
          market_cap_usd: number | null;
          volume_24h_usd: number | null;
          liquidity_usd: number | null;
        } | null;
      }>;
    },
    enabled: open && queryLooksLikeCa,
    staleTime: 45_000,
  });

  const summaryQ = useQuery({
    queryKey: ['token-summaries', recentsSlice.join(',')],
    queryFn: async () => {
      const r = await fetch(`/api/tokens/summary?mints=${encodeURIComponent(recentsSlice.join(','))}`);
      if (!r.ok) throw new Error('summary');
      return r.json() as Promise<{ tokens: SummaryRow[] }>;
    },
    enabled: open && recentsSlice.length > 0,
    staleTime: 60_000,
  });

  const byMint = useMemo(() => {
    const map = new Map<string, SummaryRow>();
    for (const t of summaryQ.data?.tokens ?? []) {
      map.set(t.mint, t);
    }
    return map;
  }, [summaryQ.data?.tokens]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) setQuickBuySettingsOpen(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  useEffect(() => {
    if (!densityMenuOpen) return;
    function onDoc(ev: MouseEvent) {
      const node = densityWrapRef.current;
      const t = ev.target;
      if (node && t instanceof Node && node.contains(t)) return;
      setDensityMenuOpen(false);
    }
    const tid = window.setTimeout(() => {
      document.addEventListener('mousedown', onDoc);
    }, 0);
    return () => {
      window.clearTimeout(tid);
      document.removeEventListener('mousedown', onDoc);
    };
  }, [densityMenuOpen]);

  function toggleProtocol(id: ProtocolId) {
    setActiveProtocols((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function navigateSearchTarget(path: string) {
    setSearchQuery('');
    setOpen(false);
    router.push(path);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = trimmedQuery;
    if (!q) return;
    if (!isValidGlobalSearchQuery(q)) {
      toast.error('Not a valid search', {
        description: 'Paste a token contract, wallet, ENS name (.eth), or TON address.',
      });
      return;
    }
    if (!searchQueryMatchesActiveChain(q, activeChain)) {
      toast.error('Wrong chain', {
        description: `Switch the header to ${CHAIN_DROPDOWN_LABEL[activeChain]} or paste an address for that chain.`,
      });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(
        `/api/search/resolve?q=${encodeURIComponent(q)}&chain=${encodeURIComponent(activeChain)}`,
      );
      const json = (await res.json()) as {
        path?: string;
        error?: string;
        message?: string;
      };
      if (res.ok && json.path) {
        navigateSearchTarget(json.path);
        return;
      }
      const fallback = buildSearchPathForQuery(q, activeChain);
      if (fallback) {
        navigateSearchTarget(fallback.path);
        return;
      }
      if (json.error === 'wrong_chain') {
        toast.error('Wrong chain', { description: json.message });
        return;
      }
      toast.error(json.error === 'ens_not_found' ? 'ENS name not found' : 'Could not resolve query');
    } catch {
      const fallback = buildSearchPathForQuery(q, activeChain);
      if (fallback) navigateSearchTarget(fallback.path);
      else toast.error('Search failed', { description: 'Check your connection and try again.' });
    } finally {
      setBusy(false);
    }
  }

  const previewSummary = useMemo((): SummaryRow | null => {
    const t = previewQ.data?.token;
    if (!t) return null;
    return {
      mint: t.mint,
      symbol: t.symbol,
      name: t.name,
      image_url: t.image_url,
    };
  }, [previewQ.data?.token]);

  const previewLive = useMemo((): LiveSearchMetrics | null => {
    const t = previewQ.data?.token;
    if (!t) return null;
    return {
      mc: Number(t.market_cap_usd) || 0,
      vol: Number(t.volume_24h_usd) || 0,
      liq: Number(t.liquidity_usd) || 0,
    };
  }, [previewQ.data?.token]);

  const historyRaw = useMemo((): SummaryRow[] => {
    if (uiDemo && activeChain === 'ton' && recentsSlice.length === 0) return DEMO_SEARCH_RECENTS;
    return recentsSlice.map((m) => {
      const meta = byMint.get(m);
      const base = meta ?? { mint: m, symbol: null, name: null, image_url: null };
      if (previewSummary && previewSummary.mint === m) {
        return { ...base, ...previewSummary };
      }
      return base;
    });
  }, [uiDemo, activeChain, recentsSlice, byMint, previewSummary]);

  const searchRaw = useMemo((): SummaryRow[] => {
    if (!queryLooksLikeCa || !previewSummary) return [];
    return [previewSummary];
  }, [queryLooksLikeCa, previewSummary]);

  const loadingHistory = summaryQ.isFetching && recentsSlice.length > 0 && !summaryQ.data;
  const loadingSearch = queryLooksLikeCa && previewQ.isFetching && !previewQ.data;

  const historyEnriched = useMemo(() => {
    const searchMints = new Set(searchRaw.map((r) => r.mint));
    const rows = historyRaw
      .filter((r) => !searchMints.has(r.mint))
      .map((row) => enrichSummaryWithLive(row, null));
    if (rows.length === 0 && !loadingHistory && uiDemo && activeChain === 'ton') {
      return DEMO_SEARCH_RECENTS.map(enrichSummary);
    }
    return rows;
  }, [historyRaw, searchRaw, loadingHistory, uiDemo, activeChain]);

  const searchEnriched = useMemo(() => {
    return searchRaw.map((row) => enrichSummaryWithLive(row, previewLive));
  }, [searchRaw, previewLive]);

  const historySorted = useMemo(
    () => sortEnrichedRows(historyEnriched, sortMode),
    [historyEnriched, sortMode],
  );

  const searchSorted = useMemo(() => {
    const filtered = filterSearchByProtocols(searchEnriched, activeProtocols);
    return sortEnrichedRows(filtered, sortMode);
  }, [searchEnriched, activeProtocols, sortMode]);

  const hasSearchSection = queryLooksLikeCa && (searchRaw.length > 0 || loadingSearch);
  const filtersActive = activeProtocols.size > 0;
  const closeSearch = () => {
    setOpen(false);
    setSearchQuery('');
  };

  if (!overlayMounted) return null;

  const rowPadding = compactRows ? 'py-1.5 min-h-[60px]' : 'py-2 min-h-[68px]';

  return (
    <div className="fixed inset-0 z-[620] flex items-start justify-center px-3 pt-[min(8vh,72px)] sm:px-4" role="presentation">
      <button
        type="button"
        className={cn(
          'absolute inset-0 bg-black/55 backdrop-blur-md',
          overlayBackdropClasses(visible),
          'fill-mode-forwards motion-reduce:transition-opacity motion-reduce:duration-200',
        )}
        aria-label="Close search"
        onClick={() => setOpen(false)}
      />
      <div
        className={cn(
          'relative z-10 flex w-full max-h-[73vh] max-w-[min(640px,100%)] origin-top flex-col overflow-hidden fill-mode-forwards motion-reduce:transition-none',
          searchModalPanelClass,
          overlayPanelFromTopClasses(visible),
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="global-search-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="global-search-title" className="sr-only">
          Search
        </h2>

        {/* Fixed header: chips + input + History / sort */}
        <div className="shrink-0 border-b border-white/[0.06] px-3 pt-2.5 pb-2">
          <div className="flex flex-wrap items-center gap-1">
            <div className="-ml-0.5 flex min-w-0 flex-1 flex-wrap items-center gap-1">
              {PROTOCOL_CHIPS.map(({ id, label, Icon, protocolLogo, activeClass, idleClass }) => {
                const on = activeProtocols.has(id);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggleProtocol(id)}
                    aria-pressed={on}
                    title="Filters search results only"
                    className={cn(
                      'focus-ring inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold transition',
                      on ? activeClass : idleClass,
                    )}
                  >
                    {protocolLogo ? (
                      <ProtocolBrandIcon protocolId={protocolLogo} dotClassName="h-3 w-3" />
                    ) : (
                      <Icon className="h-3 w-3 shrink-0 opacity-90" aria-hidden />
                    )}
                    {label}
                  </button>
                );
              })}
              {filtersActive ? (
                <span className="text-[9px] text-fg-muted">· results only</span>
              ) : null}
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-0.5">
              <div className="relative" ref={densityWrapRef}>
                <button
                  type="button"
                  onClick={() => setDensityMenuOpen((v) => !v)}
                  className={searchModalIconBtnClass}
                  aria-label="List density"
                >
                  <LayoutList className="h-3.5 w-3.5" />
                  <ChevronDown className="h-3 w-3 opacity-70" />
                </button>
                {densityMenuOpen ? (
                  <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-44 rounded-lg border border-white/[0.08] bg-bg-raised/95 py-1 shadow-xl backdrop-blur-xl">
                    <button
                      type="button"
                      className={cn(
                        'w-full px-2.5 py-1.5 text-left text-[11px] hover:bg-white/[0.06]',
                        !compactRows ? 'font-semibold text-accent-primary' : 'text-fg-secondary',
                      )}
                      onClick={() => {
                        setCompactRows(false);
                        setDensityMenuOpen(false);
                      }}
                    >
                      Comfortable rows
                    </button>
                    <button
                      type="button"
                      className={cn(
                        'w-full px-2.5 py-1.5 text-left text-[11px] hover:bg-white/[0.06]',
                        compactRows ? 'font-semibold text-accent-primary' : 'text-fg-secondary',
                      )}
                      onClick={() => {
                        setCompactRows(true);
                        setDensityMenuOpen(false);
                      }}
                    >
                      Compact rows
                    </button>
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setQuickBuySettingsOpen(true)}
                className={searchModalIconBtnClass}
                aria-label="Quick buy settings"
              >
                <Settings className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <form onSubmit={onSubmit} className="mt-2">
            <div className={searchModalInputShellClass}>
              <Search
                className={cn(
                  'mr-2 h-3.5 w-3.5 shrink-0',
                  searchQuery ? 'text-accent-primary/90' : 'text-fg-muted',
                )}
              />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                disabled={busy}
                placeholder="Search by name, ticker, or CA…"
                spellCheck={false}
                autoComplete="off"
                className="flex-1 bg-transparent text-sm text-fg-primary outline-none placeholder:text-fg-muted focus:outline-none focus:ring-0 disabled:opacity-55"
                aria-label="Search tokens and wallets"
              />
              {busy ? <Loader2 className="mr-2 h-3.5 w-3.5 shrink-0 animate-spin text-accent-primary" /> : null}
              <kbd className="pointer-events-none hidden shrink-0 rounded-md border-0 bg-white/[0.06] px-1.5 py-0.5 font-sans text-[10px] text-fg-muted sm:inline-flex">
                Esc
              </kbd>
            </div>
          </form>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-fg-muted">
              History
              <span className="rounded-md border-0 bg-white/[0.06] px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-fg-secondary">
                {CHAIN_DROPDOWN_LABEL[activeChain]}
              </span>
            </span>
            <div className="ml-auto flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
              <span className="text-[11px] text-fg-muted">Sort by</span>
              <div className="flex items-center gap-0">
                {SORT_TOOLS.map(({ id, label, Icon }) => {
                  const on = sortMode === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      title={label}
                      aria-label={label}
                      aria-pressed={on}
                      onClick={() => setSortMode(id)}
                      className={cn(
                        'focus-ring rounded-md border-0 p-1.5 transition',
                        on
                          ? 'bg-white/[0.1] text-fg-primary'
                          : 'text-fg-muted hover:bg-white/[0.07] hover:text-fg-secondary hover:backdrop-blur-sm',
                      )}
                    >
                      <Icon className={cn('h-3.5 w-3.5', id === 'relevance' && on ? '' : '')} aria-hidden />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Scroll body only */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-bg-raised px-3 py-2">
          {hasSearchSection ? (
            <section className="mb-3">
              <p className="mb-1 px-0.5 text-[10px] font-semibold uppercase tracking-wide text-fg-muted">
                Search results
              </p>
              {loadingSearch ? (
                <SearchSkeletonRows rowPadding={rowPadding} />
              ) : searchSorted.length === 0 ? (
                <p className="px-1 py-4 text-center text-[12px] text-fg-muted">
                  {filtersActive
                    ? 'No results match the selected filters.'
                    : 'Token not found on this chain.'}
                </p>
              ) : (
                <ul className="divide-y divide-white/[0.06]">
                  {searchSorted.map((row) => (
                    <SearchTokenRow
                      key={`search-${row.mint}`}
                      row={row}
                      compact={compactRows}
                      rowPadding={rowPadding}
                      quickBuySize={quickBuySize}
                      quickBuyChrome={quickBuyChrome}
                      quickBuyAmount={quickBuyAmount}
                      onCloseSearch={closeSearch}
                      showBadgeDot={fnv1aHex(row.mint) % 5 !== 0}
                    />
                  ))}
                </ul>
              )}
            </section>
          ) : null}

          {loadingHistory ? (
            <SearchSkeletonRows rowPadding={rowPadding} />
          ) : null}

          {!loadingHistory && historySorted.length === 0 && !hasSearchSection ? (
            <p className="px-1 py-6 text-center text-[12px] text-fg-muted">
              {trimmedQuery
                ? queryLooksLikeCa
                  ? 'Looking up token…'
                  : 'Paste a contract address for this chain, then press Enter.'
                : `No recent ${CHAIN_DROPDOWN_LABEL[activeChain]} tokens yet.`}
            </p>
          ) : null}

          {!loadingHistory && historySorted.length > 0 ? (
            <ul className="divide-y divide-white/[0.06] pb-2">
              {historySorted.map((row) => (
                <SearchTokenRow
                  key={`hist-${row.mint}`}
                  row={row}
                  compact={compactRows}
                  rowPadding={rowPadding}
                  quickBuySize={quickBuySize}
                  quickBuyChrome={quickBuyChrome}
                  quickBuyAmount={quickBuyAmount}
                  onCloseSearch={closeSearch}
                  showBadgeDot={fnv1aHex(row.mint) % 5 !== 0}
                />
              ))}
            </ul>
          ) : null}
        </div>

        {quickBuySettingsOpen ? (
          <SearchQuickBuySettingsPanel onClose={() => setQuickBuySettingsOpen(false)} />
        ) : null}

        {/* Fixed slim footer */}
        <div className="flex h-9 shrink-0 items-center justify-between gap-3 border-t border-white/[0.06] bg-bg-raised px-3">
          <p className="text-[11px] text-fg-muted">
            {CHAIN_DROPDOWN_LABEL[activeChain]} · CA or wallet · Enter
          </p>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className={cn(searchModalIconBtnClass, 'p-1')}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function SearchSkeletonRows({ rowPadding, muted = false }: { rowPadding: string; muted?: boolean }) {
  return (
    <>
      <ul className={cn('divide-y divide-white/[0.06]', muted && 'opacity-60')}>
        {Array.from({ length: 7 }).map((_, i) => (
          <li key={`sk-${i}`} className={cn('flex items-center gap-2', rowPadding, 'animate-pulse')}>
            <div className="h-11 w-11 shrink-0 rounded-sm bg-white/[0.06]" />
            <div className="min-w-0 flex-1 space-y-2">
              <div
                className="h-3.5 max-w-[200px] rounded-sm bg-white/[0.06]"
                style={{ width: `${48 + ((i * 17) % 40)}%` }}
              />
              <div className="h-3 w-24 rounded-sm bg-white/[0.04]" />
            </div>
            <div className="hidden gap-4 sm:flex">
              <div className="space-y-1">
                <div className="ml-auto h-2 w-6 rounded-sm bg-white/[0.05]" />
                <div className="h-3 w-12 rounded-sm bg-white/[0.06]" />
              </div>
              <div className="space-y-1">
                <div className="ml-auto h-2 w-4 rounded-sm bg-white/[0.05]" />
                <div className="h-3 w-10 rounded-sm bg-white/[0.06]" />
              </div>
              <div className="space-y-1">
                <div className="ml-auto h-2 w-4 rounded-sm bg-white/[0.05]" />
                <div className="h-3 w-11 rounded-sm bg-white/[0.06]" />
              </div>
            </div>
            <div className="h-8 w-14 shrink-0 rounded-md bg-white/[0.08]" />
          </li>
        ))}
      </ul>
      <p className="mt-3 text-center text-[11px] text-fg-muted">
        {muted ? 'No rows match filters.' : 'Loading…'}
      </p>
    </>
  );
}
