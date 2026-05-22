'use client';

import { formatDistanceToNowStrict, subMilliseconds } from 'date-fns';
import { ProtocolBrandIcon } from '@/components/tokens/ProtocolBrandIcon';
import {
  BadgeCheck,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  Clock,
  Coins,
  Copy,
  Globe,
  GraduationCap,
  LayoutList,
  LineChart,
  Loader2,
  Droplets,
  Search,
  Printer,
  Settings2,
  Shield,
  Crown,
  X,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { toast } from 'sonner';
import { TokenImage } from '@/components/shared/TokenImage';
import { isValidPublicKey, shortenAddress } from '@/lib/utils/addresses';
import {
  TON_DEMO_JETTON_A,
  TON_DEMO_JETTON_B,
  TON_NATIVE_UI_MINT,
} from '@/lib/utils/tonDemoMints';
import { cn } from '@/lib/utils/cn';
import { formatCompactUsd } from '@/lib/utils/formatters';
import { useUiDemoMode } from '@/lib/hooks/useUiDemoMode';
import { useOverlayPresence } from '@/lib/hooks/useOverlayPresence';
import { overlayBackdropClasses, overlayPanelFromTopClasses } from '@/lib/ui/overlayMotion';
import { useRecentTradeMintsStore } from '@/store/recentTradeMints';
import { useUIStore } from '@/store/ui';

/** Modal chrome (AXIOM-style command palette). */
const MODAL_BG = '#151820';
const MODAL_BORDER = '#2a2f3a';
const ROW_BORDER = '#1e2330';
const INPUT_IDLE_BORDER = '#2a2f3a';

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
  { id: 'pump', label: 'Launchpad', Icon: Coins, activeClass: 'border-emerald-500/80 text-emerald-300 shadow-[0_0_12px_-4px_rgba(52,211,153,0.45)]', idleClass: 'border-[#2a2f3a] text-[#9ca3af]' },
  { id: 'bonk', label: 'Bonk', Icon: Coins, protocolLogo: 'bonk', activeClass: 'border-orange-500/75 text-orange-300 shadow-[0_0_12px_-4px_rgba(251,146,60,0.4)]', idleClass: 'border-[#2a2f3a] text-[#9ca3af]' },
  { id: 'printr', label: 'Printr', Icon: Printer, protocolLogo: 'printr', activeClass: 'border-sky-500/75 text-sky-300', idleClass: 'border-[#2a2f3a] text-[#9ca3af]' },
  { id: 'og_mode', label: 'OG Mode', Icon: Crown, activeClass: 'border-violet-500/70 text-violet-300', idleClass: 'border-[#2a2f3a] text-[#9ca3af]' },
  { id: 'graduated', label: 'Graduated', Icon: GraduationCap, activeClass: 'border-amber-500/65 text-amber-200', idleClass: 'border-[#2a2f3a] text-[#9ca3af]' },
  { id: 'dex_paid', label: 'Dex Paid', Icon: BadgeCheck, activeClass: 'border-cyan-500/65 text-cyan-300', idleClass: 'border-[#2a2f3a] text-[#9ca3af]' },
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

/**
 * Command-palette style search: mint / wallet resolve, recent mints, Esc to close.
 */
export function GlobalSearchModal() {
  const router = useRouter();
  const open = useUIStore((s) => s.searchOpen);
  const setOpen = useUIStore((s) => s.setSearchOpen);
  const searchQuery = useUIStore((s) => s.searchQuery);
  const setSearchQuery = useUIStore((s) => s.setSearchQuery);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const densityWrapRef = useRef<HTMLDivElement | null>(null);
  const [busy, setBusy] = useState(false);
  const uiDemo = useUiDemoMode();
  const [inputFocused, setInputFocused] = useState(false);

  const { mounted: overlayMounted, visible } = useOverlayPresence(open);

  /** Active protocol filters: empty set = show all tokens. Non-empty = keep rows matching any selected protocol. */
  const [activeProtocols, setActiveProtocols] = useState<Set<ProtocolId>>(() => new Set());
  const [sortMode, setSortMode] = useState<SortMode>('relevance');
  /** Row vertical density toggled via list icon. */
  const [compactRows, setCompactRows] = useState(false);
  const [densityMenuOpen, setDensityMenuOpen] = useState(false);
  /** Secondary filters (quote preference for mock tagging / filter). */
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [activeQuotes, setActiveQuotes] = useState<Set<'native' | 'usdc' | 'usd1'>>(() => new Set());

  const recents = useRecentTradeMintsStore((s) => s.mints);
  const recentsSlice = useMemo(() => recents.slice(0, MAX_RECENT), [recents]);

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

  function toggleQuote(q: 'native' | 'usdc' | 'usd1') {
    setActiveQuotes((prev) => {
      const next = new Set(prev);
      if (next.has(q)) next.delete(q);
      else next.add(q);
      return next;
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    if (!isValidPublicKey(q)) {
      toast.error('Not a valid address', {
        description: 'Paste a TON jetton master, wallet, or friendly address. Ticker/name search is coming next.',
      });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/resolve-address?address=${encodeURIComponent(q)}`);
      const json = (await res.json()) as { kind?: string };
      const path = res.ok && json.kind === 'wallet' ? `/wallet/${q}` : `/token/${q}`;
      setSearchQuery('');
      setOpen(false);
      router.push(path);
    } catch {
      setSearchQuery('');
      setOpen(false);
      router.push(`/token/${q}`);
    } finally {
      setBusy(false);
    }
  }

  const listToRenderRaw = useMemo((): SummaryRow[] => {
    if (uiDemo && recents.length === 0) return DEMO_SEARCH_RECENTS;
    return recentsSlice.map((m) => {
      const meta = byMint.get(m);
      return meta ?? { mint: m, symbol: null, name: null, image_url: null };
    });
  }, [uiDemo, recents.length, recentsSlice, byMint]);

  const loadingList = summaryQ.isFetching && recentsSlice.length > 0 && !summaryQ.data;

  const enriched = useMemo(() => {
    const mapped = listToRenderRaw.map(enrichSummary);
    if (mapped.length === 0 && !loadingList) {
      return DEMO_SEARCH_RECENTS.map(enrichSummary);
    }
    return mapped;
  }, [listToRenderRaw, loadingList]);

  const filtered = useMemo(() => {
    let rows = enriched;
    if (activeProtocols.size > 0) {
      rows = rows.filter((r) => activeProtocols.has(r.protocol));
    }
    if (activeQuotes.size > 0) {
      const hFn = fnv1aHex;
      rows = rows.filter((r) => {
        const qPick = ['native', 'usdc', 'usd1'][(hFn(r.mint) >>> 20) % 3] as 'native' | 'usdc' | 'usd1';
        return activeQuotes.has(qPick);
      });
    }
    return rows;
  }, [enriched, activeProtocols, activeQuotes]);

  const sortedRows = useMemo(() => {
    const rows = [...filtered];
    switch (sortMode) {
      case 'time':
        return rows.sort((a, b) => a.mockAgeMs - b.mockAgeMs);
      case 'volume':
        return rows.sort((a, b) => b.mockVol - a.mockVol);
      case 'liquidity':
        return rows.sort((a, b) => b.mockLiq - a.mockLiq);
      case 'chart':
        return rows.sort((a, b) => b.mockMc - a.mockMc);
      case 'safety':
        return rows.sort((a, b) => b.mockSafety - a.mockSafety);
      default:
        return rows;
    }
  }, [filtered, sortMode]);

  if (!overlayMounted) return null;

  const rowPadding = compactRows ? 'py-1.5 min-h-[64px]' : 'py-2 min-h-[74px]';

  return (
    <div className="fixed inset-0 z-[620] flex items-start justify-center px-3 pt-[min(8vh,72px)] sm:px-4" role="presentation">
      <button
        type="button"
        className={cn(
          'absolute inset-0 bg-black/50 backdrop-blur-[6px]',
          overlayBackdropClasses(visible),
          'fill-mode-forwards motion-reduce:transition-opacity motion-reduce:duration-200',
        )}
        aria-label="Close search"
        onClick={() => setOpen(false)}
      />
      <div
        className={cn(
          'relative z-10 flex w-full max-h-[73vh] max-w-[min(680px,100%)] origin-top flex-col overflow-hidden rounded-[11px] fill-mode-forwards shadow-[0_24px_80px_-20px_rgba(0,0,0,0.75)] motion-reduce:transition-none',
          overlayPanelFromTopClasses(visible),
        )}
        style={{ backgroundColor: MODAL_BG, borderWidth: 1, borderStyle: 'solid', borderColor: MODAL_BORDER }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="global-search-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="global-search-title" className="sr-only">
          Search
        </h2>

        {/* Fixed header: chips + input + History / sort */}
        <div className="shrink-0 border-b px-3 pt-2 pb-2" style={{ borderColor: MODAL_BORDER }}>
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
                    className={cn(
                      'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#5865F2]',
                      'inline-flex items-center gap-1 rounded-full border px-2 py-[3px] text-[10px] font-semibold transition',
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
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-0.5">
              <div className="relative" ref={densityWrapRef}>
                <button
                  type="button"
                  onClick={() => setDensityMenuOpen((v) => !v)}
                  className="focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#5865F2] inline-flex items-center rounded-md border p-1 text-[#9ca3af] transition hover:bg-white/[0.04] hover:text-white"
                  style={{ borderColor: INPUT_IDLE_BORDER }}
                  aria-label="List density"
                >
                  <LayoutList className="h-3.5 w-3.5" />
                  <ChevronDown className="h-3 w-3 opacity-70" />
                </button>
                {densityMenuOpen ? (
                  <div
                    className="absolute right-0 top-[calc(100%+6px)] z-50 w-44 rounded-lg border bg-[#0f1219] py-1 shadow-xl"
                    style={{ borderColor: MODAL_BORDER }}
                  >
                    <button
                      type="button"
                      className={cn(
                        'w-full px-2.5 py-1.5 text-left text-[11px] hover:bg-white/[0.06]',
                        !compactRows ? 'font-semibold text-[#dbeafe]' : 'text-[#cbd5e1]',
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
                        compactRows ? 'font-semibold text-[#dbeafe]' : 'text-[#cbd5e1]',
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
                onClick={() => setFiltersOpen((v) => !v)}
                className={cn(
                  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#5865F2] inline-flex rounded-md border p-1 transition hover:bg-white/[0.04]',
                  filtersOpen ? 'border-[#5865F2]/55 text-[#93c5fd]' : 'text-[#9ca3af] hover:text-white',
                )}
                style={{ borderColor: filtersOpen ? '#3b5998' : INPUT_IDLE_BORDER }}
                aria-expanded={filtersOpen}
                aria-label="Quote filters"
              >
                <Settings2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {filtersOpen ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-2 border-t pt-1.5" style={{ borderColor: ROW_BORDER }}>
              <span className="text-[10px] font-medium uppercase tracking-wide text-[#6b7280]">Quote</span>
              {(
                [
                  ['native', 'TON'],
                  ['usdc', 'USDC'],
                  ['usd1', 'USD1'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={activeQuotes.has(id)}
                  onClick={() => toggleQuote(id)}
                  className={cn(
                    'rounded-full border px-2 py-0.5 text-[10px] font-semibold transition',
                    activeQuotes.has(id)
                      ? 'border-[#5865F2]/60 bg-[#5865F2]/15 text-[#bae6fd]'
                      : 'border-[#2a2f3a] text-[#9ca3af] hover:bg-white/[0.04]',
                  )}
                >
                  {label}
                </button>
              ))}
              <span className="text-[10px] text-[#5c6578]">
                Narrow mock history by inferred quote pairing. Empty = all.
              </span>
            </div>
          ) : null}

          <form onSubmit={onSubmit} className="mt-2">
            <div
              className={cn(
                'flex h-[52px] items-center rounded-[10px] border bg-[#0f1118] pl-3 pr-2 transition-[border-color,box-shadow]',
                inputFocused
                  ? 'border-[#5865F2]/85 shadow-[0_0_0_1px_rgba(91,117,239,0.35)]'
                  : 'shadow-none',
              )}
              style={{ borderColor: inputFocused ? undefined : INPUT_IDLE_BORDER }}
            >
              <Search className={cn('mr-2 h-4 w-4 shrink-0', searchQuery ? 'text-[#818cf8]' : 'text-[#6b7280]')} />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                disabled={busy}
                placeholder="Search by name, ticker, or CA…"
                spellCheck={false}
                autoComplete="off"
                className={cn(
                  'flex-1 bg-transparent py-0 font-sans outline-none placeholder:text-[#5c6578] disabled:opacity-55',
                  'text-[18px] leading-snug tracking-tight text-white',
                  'focus:outline-none focus:ring-0',
                )}
                aria-label="Search tokens and wallets"
              />
              {busy ? <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin text-[#818cf8]" /> : null}
              <kbd
                className="pointer-events-none hidden shrink-0 rounded-md border px-2 py-[3px] font-sans text-[11px] text-[#6b7280] sm:inline-flex"
                style={{ borderColor: INPUT_IDLE_BORDER, backgroundColor: '#0b0e14' }}
              >
                Esc
              </kbd>
            </div>
          </form>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#6b7280]">
              History
            </span>
            <div className="ml-auto flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
              <span className="text-[11px] text-[#6b7280]">Sort Results by</span>
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
                        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#5865F2]',
                        'rounded-full p-1.5 transition',
                        on ? 'bg-[#2563eb]/30 text-[#93c5fd]' : 'text-[#64748b] hover:bg-white/[0.06] hover:text-[#cbd5e1]',
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
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2">
          {loadingList ? <SearchSkeletonRows rowPadding={rowPadding} /> : null}

          {!loadingList && sortedRows.length === 0 ? <SearchSkeletonRows muted rowPadding={rowPadding} /> : null}

          {!loadingList && sortedRows.length > 0 ? (
            <ul className="divide-y divide-[#1e2330] pb-2">
              {sortedRows.map((row) => {
                const mint = row.mint;
                const name = row.name?.trim() ?? '';
                const sym = row.symbol?.trim() ?? '';
                const symbolTitle = sym || shortenAddress(mint, 4);
                const nameMuted = name && name.toLowerCase() !== symbolTitle.toLowerCase() ? name : shortenAddress(mint, 5);
                const createdAt = subMilliseconds(new Date(), row.mockAgeMs);
                const ageLabel = formatDistanceToNowStrict(createdAt, { addSuffix: false });
                const showBadgeDot = fnv1aHex(mint) % 5 !== 0;
                const closeSearch = () => {
                  setOpen(false);
                  setSearchQuery('');
                };
                async function copyMint() {
                  try {
                    await navigator.clipboard.writeText(mint);
                    toast.success('Mint copied');
                  } catch {
                    toast.error('Copy failed');
                  }
                }

                return (
                  <li
                    key={mint}
                    className={cn('group flex items-stretch gap-2 transition-colors', rowPadding, 'hover:bg-[#1a1d27]')}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-1 pr-1">
                      <Link
                        href={`/token/${encodeURIComponent(mint)}`}
                        onClick={closeSearch}
                        className={cn(
                          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#5865F2]',
                          'flex min-w-0 flex-1 items-center gap-2 rounded-md py-0.5 pr-2',
                        )}
                      >
                        <div className="relative shrink-0">
                          <TokenImage src={row.image_url} alt="" size={compactRows ? 44 : 50} className="rounded-[8px]" />
                          {showBadgeDot ? (
                            <span
                              className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 shadow-sm"
                              style={{ borderColor: MODAL_BG, backgroundColor: '#facc15' }}
                              title="Launch status"
                            />
                          ) : null}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-center gap-1 overflow-hidden">
                            <span className="truncate text-[14px] font-semibold tracking-tight text-white">{symbolTitle}</span>
                            <span className="truncate text-[11px] text-[#7c8498]">{nameMuted}</span>
                          </div>
                          <div className={cn('mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]')}>
                            <span className="font-medium text-[#5eead4]">{ageLabel}</span>
                            <span className="text-[10px] text-[#5c6578]">{row.dexLabel}</span>
                            <span className="flex items-center gap-1 text-[#5c6578]">
                              <Globe className="h-3 w-3 shrink-0" aria-hidden />
                              <Shield className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
                            </span>
                          </div>
                        </div>

                        {/* Stats */}
                        <div className="grid shrink-0 grid-cols-3 gap-x-3 tabular-nums sm:gap-x-5">
                          <div className="text-right">
                            <div className="text-[11px] text-[#6b7280]">MC</div>
                            <div className="text-[14px] font-semibold leading-tight text-white">{formatCompactUsd(row.mockMc)}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-[11px] text-[#6b7280]">V</div>
                            <div className="text-[14px] font-semibold leading-tight text-white">{formatCompactUsd(row.mockVol)}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-[11px] text-[#6b7280]">L</div>
                            <div className="text-[14px] font-semibold leading-tight text-white">{formatCompactUsd(row.mockLiq)}</div>
                          </div>
                        </div>
                      </Link>
                      <button
                        type="button"
                        onClick={() => void copyMint()}
                        className={cn(
                          'shrink-0 self-start rounded p-1.5 text-[#5c6578] transition hover:bg-white/[0.06] hover:text-[#cbd5e1]',
                          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#5865F2]',
                        )}
                        aria-label="Copy mint"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <Link
                      href={`/token/${encodeURIComponent(mint)}`}
                      onClick={closeSearch}
                      aria-label={`Instant trade ${symbolTitle}`}
                      className={cn(
                        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#5865F2]',
                        'flex h-10 w-10 shrink-0 items-center justify-center self-center rounded-full bg-[#2563eb] text-white shadow-md transition hover:brightness-110 active:brightness-95',
                      )}
                      title="Open token"
                    >
                      <Zap className="h-4 w-4" fill="currentColor" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>

        {/* Fixed slim footer */}
        <div className="flex h-10 shrink-0 items-center justify-between gap-3 border-t px-3" style={{ borderColor: MODAL_BORDER, backgroundColor: '#12151c' }}>
          <p className="text-[11px] text-[#5c6578]">Mint or wallet CA · Enter to go · Name search next</p>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded p-1 text-[#6b7280] transition hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#5865F2]"
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
      <ul className={cn('divide-y divide-[#1e2330]', muted && 'opacity-70')}>
        {Array.from({ length: 7 }).map((_, i) => (
          <li key={`sk-${i}`} className={cn('flex items-center gap-2', rowPadding, 'animate-pulse')}>
            <div className="h-[50px] w-[50px] shrink-0 rounded-[8px] bg-white/[0.06]" />
            <div className="min-w-0 flex-1 space-y-2">
              <div
                className="h-4 max-w-[200px] rounded bg-white/[0.08]"
                style={{ width: `${48 + ((i * 17) % 40)}%` }}
              />
              <div className="h-3 w-24 rounded bg-white/[0.05]" />
            </div>
            <div className="hidden gap-4 sm:flex">
              <div className="space-y-1">
                <div className="ml-auto h-2 w-6 rounded bg-white/[0.05]" />
                <div className="h-3 w-12 rounded bg-white/[0.08]" />
              </div>
              <div className="space-y-1">
                <div className="ml-auto h-2 w-4 rounded bg-white/[0.05]" />
                <div className="h-3 w-10 rounded bg-white/[0.08]" />
              </div>
              <div className="space-y-1">
                <div className="ml-auto h-2 w-4 rounded bg-white/[0.05]" />
                <div className="h-3 w-11 rounded bg-white/[0.08]" />
              </div>
            </div>
            <div className="h-10 w-10 shrink-0 rounded-full bg-[#2563eb]/30" />
          </li>
        ))}
      </ul>
      <p className="mt-3 text-center text-[11px] text-[#6b7280]">
        {muted ? 'No rows match filters — adjust pads or quotes, or browse mock rows above.' : 'Loading recent tokens…'}
      </p>
    </>
  );
}
