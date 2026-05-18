'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, ArrowUpDown, BarChart3, ChevronUp, Copy, HelpCircle, Wallet, Zap } from 'lucide-react';
import type { AppChainId } from '@/lib/chains/appChain';
import { nativeTicker } from '@/lib/chains/nativeCurrency';
import { formatCompactUsd, formatDuration, formatNumber, formatRelativeTime, formatAgeShort } from '@/lib/utils/formatters';
import { shortenAddress } from '@/lib/utils/addresses';
import type { Tables } from '@/lib/supabase/types';
import type { DevWalletStatsRow } from '@/lib/db/wallets';
import { cn } from '@/lib/utils/cn';
import { HoldersTable } from '@/components/tokens/HoldersTable';
import { DevSection } from '@/components/tokens/DevSection';
import { TopTraderWalletCell } from '@/components/tokens/TopTraderWalletCell';
import { EmptyState } from '@/components/shared/EmptyState';
import { Skeleton } from '@/components/shared/Skeleton';
import { demoWalletAt, syntheticTradesForMint, syntheticTopTradersForMint } from '@/lib/dev/demoTokenFixtures';
import { preferTokenTableDemoRows } from '@/lib/dev/uiDemoMode';
import { useUiDemoMode } from '@/lib/hooks/useUiDemoMode';
import { useTrackedWalletsLookup } from '@/lib/hooks/useTrackedWalletsLookup';
import { useWalletLabels } from '@/lib/hooks/useWalletLabels';
import type { MintTopTraderRow } from '@/lib/trading/mintTopTraders';
import type { TraderDeskFilter } from '@/lib/walletIdentity/traderFilters';
import { traderRowMatchesFilter, TRADER_FILTER_OPTIONS } from '@/lib/walletIdentity/traderFilters';
import { useUIStore } from '@/store/ui';

/** Rough native/USD for converting USD notionals in the “native units” column toggle (UI preview). */
const NATIVE_USD_HINT: Record<AppChainId, number> = {
  sol: 210,
  ton: 5.5,
  bnb: 650,
  base: 3200,
};

type TabId = 'trades' | 'positions' | 'orders' | 'holders' | 'traders' | 'dev_tokens';

type TradeRow = Tables<'trades'>;

/** Theme-aware Axiom-style zebra — two greys separated by ~1 step in RGB space. */
function zebraDesk(i: number): string {
  return i % 2 === 0 ? 'bg-desk-a' : 'bg-desk-b';
}

const TABS: { id: TabId; label: string }[] = [
  { id: 'trades', label: 'Trades' },
  { id: 'positions', label: 'Positions' },
  { id: 'orders', label: 'Orders' },
  { id: 'holders', label: 'Holders' },
  { id: 'traders', label: 'Top Traders' },
  { id: 'dev_tokens', label: 'Dev Tokens' },
];

/** USD notional at print (price × size) — same read as the live trades side-panel “MC” hint. */
function tradeFillMcUsdLabel(t: TradeRow): string {
  const px = t.price_usd_at_fill;
  const amt = t.amount_token;
  if (px == null || amt == null || !Number.isFinite(px) || !Number.isFinite(amt)) return '\u2014';
  const v = px * amt;
  if (!Number.isFinite(v) || v === 0) return '\u2014';
  return formatCompactUsd(v);
}

function tradeTraderHint(t: TradeRow, rowIndex: number): string {
  if (String(t.id).startsWith('demo-')) {
    const w = demoWalletAt(rowIndex);
    return `${w.slice(0, 4)}\u2026${w.slice(-4)}`;
  }
  const sig = t.tx_signature;
  if (sig.length >= 12) return `${sig.slice(0, 4)}\u2026${sig.slice(-4)}`;
  return shortenAddress(String(t.user_id), 4);
}

function MintTradesScroll({
  rows,
  nativeSym,
  onHoverChange,
}: {
  rows: TradeRow[];
  nativeSym: string;
  onHoverChange: (paused: boolean) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showBackTop, setShowBackTop] = useState(false);
  const maxSol = useMemo(
    () => rows.reduce((m, t) => Math.max(m, t.amount_sol ?? 0), 0),
    [rows],
  );
  const maxTok = useMemo(
    () => rows.reduce((m, t) => Math.max(m, t.amount_token ?? 0), 0),
    [rows],
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => setShowBackTop(el.scrollTop > 120);
    onScroll();
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [rows.length]);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        className="desk-scroll-well min-h-0 flex-1 overflow-x-auto overflow-y-auto overscroll-y-auto rounded-b-[6px] touch-pan-y border border-border-subtle/25 border-t-0 bg-bg-base/25 shadow-[inset_0_1px_0_rgb(var(--border-subtle-rgb)/0.45)] [scrollbar-gutter:stable] [-ms-overflow-style:auto] [scrollbar-width:thin] [scrollbar-color:rgb(var(--border-strong-rgb)/0.65)_transparent]"
        onPointerEnter={() => onHoverChange(true)}
        onPointerLeave={() => onHoverChange(false)}
      >
        <table className="w-full min-w-[720px] border-collapse text-left tabular-nums">
          <thead className="sticky top-0 z-[2] border-b border-border-subtle/30 bg-bg-raised/90 text-left shadow-[0_1px_0_rgb(var(--border-subtle-rgb)/0.35)] backdrop-blur-md">
            <tr>
              <th className="px-2.5 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-fg-muted">
                <span className="inline-flex items-center gap-0.5">
                  Age / Time
                  <ArrowUpDown className="h-3 w-3 opacity-60" strokeWidth={2} aria-hidden />
                </span>
              </th>
              <th className="px-2.5 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-fg-muted">
                Type
              </th>
              <th className="px-2.5 py-1.5 text-right text-[11px] font-semibold uppercase tracking-wide text-fg-muted">
                MC
              </th>
              <th className="px-2.5 py-1.5 text-right text-[11px] font-semibold uppercase tracking-wide text-fg-muted">
                Amount
              </th>
              <th className="relative px-2.5 py-1.5 text-right text-[11px] font-semibold uppercase tracking-wide text-fg-muted">
                <span className="flex items-center justify-end gap-0.5">
                  Total {nativeSym}
                  <HelpCircle className="h-3 w-3 opacity-50" strokeWidth={2} aria-hidden />
                </span>
              </th>
              <th className="px-2.5 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-fg-muted">
                Trader
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t, i) => {
              const sol = t.amount_sol ?? 0;
              const tok = t.amount_token ?? 0;
              const pctSol = maxSol > 0 && sol > 0 ? Math.min(100, (sol / maxSol) * 100) : 0;
              const pctTok = maxTok > 0 && tok > 0 ? Math.min(100, (tok / maxTok) * 100) : 0;
              const zebra = zebraDesk(i);
              const sideBuy = t.side === 'buy';
              const barCls = sideBuy ? 'bg-signal-bull/55' : 'bg-signal-bear/50';
              return (
                <tr
                  key={t.id}
                  className={cn(
                    'group border-b border-border-subtle/35 transition-colors hover:bg-bg-hover/40',
                    zebra,
                  )}
                >
                  <td className="whitespace-nowrap px-2.5 py-2.5 align-middle text-[12px] text-fg-muted">
                    {formatRelativeTime(t.submitted_at)}
                  </td>
                  <td className="px-2.5 py-2.5 align-middle text-[12px] font-semibold capitalize">
                    <span className={sideBuy ? 'text-signal-bull' : 'text-signal-bear'}>{t.side}</span>
                  </td>
                  <td className="px-2.5 py-2.5 text-right align-middle text-[12px] text-fg-secondary">
                    {tradeFillMcUsdLabel(t)}
                  </td>
                  <td className="px-2.5 py-2.5 text-right align-middle text-[12px] font-medium text-fg-primary">
                    <div className="relative min-h-[2.5rem] overflow-hidden rounded-sm py-1.5 pr-1">
                      <div
                        className={cn('pointer-events-none absolute inset-y-0 left-0 opacity-80', barCls)}
                        style={{ width: `${pctTok}%` }}
                      />
                      <span className="relative z-[1] block text-right tabular-nums">
                        {t.amount_token != null ? formatNumber(t.amount_token, { compact: true }) : '\u2014'}
                      </span>
                    </div>
                  </td>
                  <td className="relative px-0 py-0 align-middle">
                    <div className="relative min-h-[2.75rem] overflow-hidden px-2.5 py-2">
                      <div
                        className={cn('pointer-events-none absolute inset-y-0 left-0 opacity-90', barCls)}
                        style={{ width: `${pctSol}%` }}
                      />
                      <span className="relative z-[1] block text-right text-[12px] font-semibold tabular-nums text-fg-primary">
                        {t.amount_sol != null ? formatNumber(t.amount_sol, { decimals: 4 }) : '\u2014'}
                      </span>
                    </div>
                  </td>
                  <td className="px-2.5 py-2.5 align-middle">
                    <div className="flex min-w-0 items-center justify-between gap-1">
                      <span className="min-w-0 truncate font-mono text-[11px] text-fg-secondary">
                        {tradeTraderHint(t, i)}
                      </span>
                      <button
                        type="button"
                        className="shrink-0 rounded p-0.5 text-fg-muted opacity-0 transition-opacity hover:text-fg-primary group-hover:opacity-100"
                        title="Copy tx signature"
                        onClick={(e) => {
                          e.stopPropagation();
                          void navigator.clipboard.writeText(t.tx_signature);
                        }}
                      >
                        <Copy className="h-3 w-3" strokeWidth={2} aria-hidden />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {showBackTop ? (
        <button
          type="button"
          className="pointer-events-auto absolute bottom-3 right-3 z-10 flex items-center gap-1 rounded-full border border-border-subtle bg-bg-raised/95 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-fg-secondary shadow-md backdrop-blur-sm transition hover:border-border-default hover:text-fg-primary"
          onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
        >
          <ChevronUp className="h-3 w-3" strokeWidth={2} aria-hidden />
          Top
        </button>
      ) : null}
    </div>
  );
}

function PlaceholderTab({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex min-h-[10rem] flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      <p className="text-[12px] font-semibold text-fg-primary">{title}</p>
      <p className="max-w-sm text-[11px] leading-relaxed text-fg-muted">{body}</p>
    </div>
  );
}

/** No live positions API yet — Axiom empty state: structured desk + skeleton rows (not fake PnL). */
function PositionsDesk({ sym }: { sym: string }) {
  const cols = ['Token', 'Bought', 'Sold', 'Remaining', 'PnL', 'Actions'] as const;
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border-subtle/40 px-2 py-1.5 text-[10px] text-fg-muted">
        <span>Your wallets · this mint</span>
        <span className="tabular-nums opacity-80">—</span>
      </div>
      <div className="desk-scroll-well min-h-0 flex-1 overflow-x-auto overflow-y-auto overscroll-y-auto rounded-b-[6px] border border-border-subtle/25 border-t-0 bg-bg-base/25 shadow-[inset_0_1px_0_rgb(var(--border-subtle-rgb)/0.45)] [scrollbar-gutter:stable] touch-pan-y [scrollbar-width:thin] [scrollbar-color:rgb(var(--border-strong-rgb)/0.65)_transparent]">
        <table className="w-full min-w-[640px] border-collapse text-left tabular-nums">
          <thead className="sticky top-0 z-[1] border-b border-border-subtle bg-bg-raised/95 backdrop-blur-sm">
            <tr>
              {cols.map((name) => (
                <th
                  key={name}
                  className={cn(
                    'px-2.5 py-2 text-[11px] font-semibold uppercase tracking-wide text-fg-muted',
                    name === 'Token' ? 'text-left' : 'text-right',
                  )}
                >
                  {name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 12 }, (_, i) => (
              <tr key={i} className={cn('border-b border-border-subtle/35', zebraDesk(i))}>
                <td className="px-2.5 py-2.5 align-middle">
                  <div className="h-2 max-w-[5rem] rounded-sm bg-fg-muted/[0.14]" />
                </td>
                <td className="px-2.5 py-2.5 align-middle">
                  <div className="ml-auto h-2 max-w-[4.5rem] rounded-sm bg-fg-muted/[0.12]" />
                </td>
                <td className="px-2.5 py-2.5 align-middle">
                  <div className="ml-auto h-2 max-w-[4rem] rounded-sm bg-fg-muted/[0.12]" />
                </td>
                <td className="px-2.5 py-2.5 align-middle">
                  <div className="ml-auto h-2 max-w-[5rem] rounded-sm bg-fg-muted/[0.13]" />
                </td>
                <td className="px-2.5 py-2.5 align-middle">
                  <div className="ml-auto h-2 max-w-[3.5rem] rounded-sm bg-fg-muted/[0.11]" />
                </td>
                <td className="px-2.5 py-2.5 align-middle">
                  <div className="ml-auto h-6 max-w-[4.25rem] rounded-md bg-fg-muted/[0.08]" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="shrink-0 border-t border-border-subtle/30 px-2 py-1.5 text-center text-[10px] text-fg-muted">
        No active positions for {sym} · connect wallet to populate
      </p>
    </div>
  );
}

function OrdersDesk({ sym }: { sym: string }) {
  const showDemoRows = preferTokenTableDemoRows();
  const types = ['Limit', 'TWAP', 'Limit', 'Stop'] as const;

  if (!showDemoRows) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border-subtle/40 px-2 py-1.5 text-[10px] text-fg-muted">
          <span>Your open orders · this mint</span>
          <span className="tabular-nums opacity-70">0 open</span>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <table className="w-full min-w-[720px] border-collapse text-left tabular-nums">
            <thead className="sticky top-0 z-[1] border-b border-border-subtle bg-bg-raised/95 backdrop-blur-sm">
              <tr>
                <th className="px-2.5 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-fg-muted">
                  Token
                </th>
                <th className="px-2.5 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-fg-muted">
                  Type
                </th>
                <th className="px-2.5 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-fg-muted">
                  Amount
                </th>
                <th className="px-2.5 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-fg-muted">
                  Current MC
                </th>
                <th className="px-2.5 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-fg-muted">
                  Target MC
                </th>
                <th className="px-2.5 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-fg-muted">
                  Settings
                </th>
                <th className="px-2.5 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-fg-muted">
                  Action
                </th>
              </tr>
            </thead>
          </table>
          <div className="flex min-h-[12rem] flex-1 flex-col items-center justify-center px-6 py-10">
            <p className="text-[13px] font-medium text-fg-secondary">No orders found</p>
            <p className="mt-1 max-w-sm text-center text-[11px] leading-relaxed text-fg-muted">
              Active limit MC and TWAP instructions you place from this terminal appear here — scoped to your
              signed-in wallets.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border-subtle/40 px-2 py-1.5 text-[10px] text-fg-muted">
        <span>Your open orders · preview rows (layout)</span>
        <span className="tabular-nums">14 open</span>
      </div>
      <div className="desk-scroll-well min-h-0 flex-1 overflow-x-auto overflow-y-auto overscroll-y-auto rounded-b-[6px] border border-border-subtle/25 border-t-0 bg-bg-base/25 shadow-[inset_0_1px_0_rgb(var(--border-subtle-rgb)/0.45)] [scrollbar-gutter:stable] touch-pan-y [scrollbar-width:thin] [scrollbar-color:rgb(var(--border-strong-rgb)/0.65)_transparent]">
        <table className="w-full min-w-[780px] border-collapse text-left tabular-nums">
          <thead className="sticky top-0 z-[1] border-b border-border-subtle bg-bg-raised/95 backdrop-blur-sm">
            <tr>
              <th className="px-2.5 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-fg-muted">
                Token
              </th>
              <th className="px-2.5 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-fg-muted">
                Type
              </th>
              <th className="px-2.5 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-fg-muted">
                Amount
              </th>
              <th className="px-2.5 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-fg-muted">
                Current MC
              </th>
              <th className="px-2.5 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-fg-muted">
                Target MC
              </th>
              <th className="px-2.5 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-fg-muted">
                Settings
              </th>
              <th className="px-2.5 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-fg-muted">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 14 }, (_, i) => {
              const side = i % 2 === 0 ? 'Buy' : 'Sell';
              return (
                <tr
                  key={i}
                  className={cn(
                    'border-b border-border-subtle/35 transition-colors hover:bg-bg-hover/35',
                    zebraDesk(i),
                  )}
                >
                  <td className="px-2.5 py-2 text-[12px] font-semibold text-fg-primary">{sym}</td>
                  <td className="px-2.5 py-2 text-[12px] text-fg-secondary">{types[i % types.length]}</td>
                  <td className="px-2.5 py-2 text-right text-[12px] text-fg-primary">
                    {(1.8 + i * 0.31).toFixed(2)} {sym}
                  </td>
                  <td className="px-2.5 py-2 text-right text-[12px] text-fg-secondary">
                    {formatCompactUsd(1_200_000 + i * 80_000)}
                  </td>
                  <td className="px-2.5 py-2 text-right text-[12px] text-fg-secondary">
                    {formatCompactUsd(2_400_000 + i * 50_000)}
                  </td>
                  <td className="px-2.5 py-2 text-right">
                    <span className="inline-block h-2 w-8 rounded bg-fg-muted/20" title="Preview" />
                  </td>
                  <td
                    className={cn(
                      'px-2.5 py-2 text-right text-[11px] font-semibold',
                      side === 'Buy' ? 'text-signal-bull' : 'text-signal-bear',
                    )}
                  >
                    {side}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Header cell — uppercase comes from thead; subtitles use explicit `normal-case`.
 * Sort glyph: hover-only unless `sortGlyph` disabled (non-sort columns).
 */
function SortableTh({
  children,
  className,
  align = 'left',
  sortGlyph = true,
}: {
  children: React.ReactNode;
  className?: string;
  align?: 'left' | 'right' | 'center';
  sortGlyph?: boolean;
}) {
  const justify =
    align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start';
  return (
    <th
      className={cn(
        'group/th px-2.5 py-1.5 align-middle text-[11px] font-semibold uppercase tracking-wide text-fg-muted leading-none',
        align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left',
        className,
      )}
    >
      <span className={cn('inline-flex items-center gap-1', justify)}>
        <span>{children}</span>
        {sortGlyph ? (
          <ArrowUpDown
            className="h-3 w-3 shrink-0 text-fg-muted opacity-0 transition-opacity duration-100 group-hover/th:opacity-100"
            strokeWidth={2}
            aria-hidden
          />
        ) : null}
      </span>
    </th>
  );
}

function RealPnlInfoTooltip({ sym }: { sym: string }) {
  return (
    <span className="group/info relative inline-flex items-center" tabIndex={0} aria-label="What is Real. PnL?">
      <HelpCircle
        className="h-3 w-3 cursor-help text-fg-muted/80 transition-colors group-hover/info:text-fg-secondary"
        strokeWidth={2}
      />
      <span
        role="tooltip"
        className="pointer-events-none absolute right-0 top-full z-20 mt-1.5 w-64 rounded-md border border-border-subtle bg-bg-raised/95 px-2.5 py-2 text-[11px] font-normal normal-case leading-snug tracking-normal text-fg-muted opacity-0 shadow-lg backdrop-blur-md transition-opacity duration-100 group-hover/info:opacity-100 group-focus-within/info:opacity-100"
      >
        <span className="font-semibold text-fg-primary">Realized PnL</span> ranks wallets on{' '}
        <span className="font-semibold text-fg-primary">{sym}</span> only (Pointer fills · FIFO desk). Same
        terminal pattern as majors: token-scoped, not global best traders on-chain.
      </span>
    </span>
  );
}

export function TokenActivityTabs({
  mint,
  symbol,
  creatorWallet,
  dev,
  tradesPanel,
  onTradesPanelChange,
  onLiveTradesSnapshot,
  onOpenInstantTrade,
}: {
  mint: string;
  symbol: string | null;
  creatorWallet: string | null;
  dev: DevWalletStatsRow | null;
  tradesPanel: boolean;
  onTradesPanelChange: (v: boolean) => void;
  onLiveTradesSnapshot?: (s: { rows: TradeRow[]; isLoading: boolean }) => void;
  onOpenInstantTrade?: () => void;
}) {
  const [tab, setTab] = useState<TabId>('trades');
  const [tradesFeedHoverPause, setTradesFeedHoverPause] = useState(false);
  const [onlyTracked, setOnlyTracked] = useState(false);
  const [traderDeskFilter, setTraderDeskFilter] = useState<TraderDeskFilter>('all');
  const [tableUsd, setTableUsd] = useState(true);
  const uiDemo = useUiDemoMode();
  const { isTracked } = useTrackedWalletsLookup();
  const { resolveLabel } = useWalletLabels();
  const activeChain = useUIStore((s) => s.activeChain);
  const nativeSym = nativeTicker(activeChain);
  const nativeUsdHint = NATIVE_USD_HINT[activeChain];

  const tradesQ = useQuery({
    queryKey: ['mint-trades', mint],
    queryFn: async () => {
      const r = await fetch(`/api/tokens/${encodeURIComponent(mint)}/trades?limit=80`);
      if (!r.ok) throw new Error('trades');
      return r.json() as Promise<{ trades: TradeRow[] }>;
    },
    enabled: tab === 'trades',
    staleTime: 15_000,
    refetchInterval: tab === 'trades' && !tradesFeedHoverPause ? 4500 : false,
    refetchOnWindowFocus: tab === 'trades' ? !tradesFeedHoverPause : true,
  });

  const tradersQ = useQuery({
    queryKey: ['mint-top-traders', mint],
    queryFn: async () => {
      const r = await fetch(`/api/tokens/${encodeURIComponent(mint)}/top-traders?limit=25`);
      if (!r.ok) throw new Error('traders');
      return r.json() as Promise<{ traders: MintTopTraderRow[] }>;
    },
    enabled: tab === 'traders',
    staleTime: 30_000,
  });

  const holdersQ = useQuery({
    queryKey: ['token-holders', mint],
    queryFn: async () => {
      const r = await fetch(`/api/tokens/${encodeURIComponent(mint)}/holders`);
      if (!r.ok) throw new Error('holders_failed');
      return r.json() as Promise<{ holders: { id: number }[] }>;
    },
    staleTime: 60_000,
  });

  const sym = symbol ?? 'TOK';
  const tableDemoEnv = preferTokenTableDemoRows();

  const tradeRowsForTable = useMemo((): TradeRow[] => {
    if (tradesQ.isLoading && !tradesQ.data) return [];
    const raw = tradesQ.data?.trades ?? [];
    const showSynthetic =
      !tradesQ.isLoading &&
      tradesQ.data != null &&
      (tableDemoEnv || (uiDemo && (raw.length === 0 || tradesQ.isError)));
    return showSynthetic ? syntheticTradesForMint(mint) : raw;
  }, [tradesQ.data, tradesQ.isLoading, tradesQ.isError, uiDemo, mint, tableDemoEnv]);

  useEffect(() => {
    onLiveTradesSnapshot?.({
      rows: tradeRowsForTable,
      isLoading: tradesQ.isLoading,
    });
  }, [tradeRowsForTable, tradesQ.isLoading, onLiveTradesSnapshot]);

  useEffect(() => {
    if (tab !== 'trades') setTradesFeedHoverPause(false);
  }, [tab]);

  const tradersBody = useMemo(() => {
    if (tradersQ.isLoading) {
      return (
        <div className="space-y-2 p-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-full" />
          ))}
        </div>
      );
    }
    const raw = tradersQ.data?.traders ?? [];
    const showSynthetic =
      !tradersQ.isLoading &&
      (tableDemoEnv || (uiDemo && (raw.length === 0 || tradersQ.isError)));
    const rows = showSynthetic ? syntheticTopTradersForMint(mint) : raw;
    const afterTrack = onlyTracked ? rows.filter((w) => isTracked(w.wallet_address)) : rows;
    const displayRows =
      traderDeskFilter === 'all'
        ? afterTrack
        : afterTrack.filter((w) =>
            traderRowMatchesFilter({
              row: w,
              creatorWallet,
              tracked: isTracked(w.wallet_address),
              labelDisp: resolveLabel(w.wallet_address, 5),
              filter: traderDeskFilter,
            }),
          );
    const maxBuy = displayRows.reduce((m, w) => Math.max(m, w.buy_usd), 0);
    const maxSell = displayRows.reduce((m, w) => Math.max(m, w.sell_usd), 0);
    const fmtUsdCell = (v: number) =>
      tableUsd ? formatCompactUsd(v) : `${formatNumber(v / nativeUsdHint, { decimals: 4 })} ${nativeSym}`;

    if (displayRows.length === 0) {
      const lensEmpty = traderDeskFilter !== 'all' && afterTrack.length > 0;
      return (
        <div className="p-4">
          <EmptyState
            icon={BarChart3}
            title={
              lensEmpty
                ? 'No wallets match filter'
                : onlyTracked
                  ? 'No tracked traders here'
                  : 'No ranked traders'
            }
            description={
              lensEmpty
                ? 'Loosen desk filters / pick “All”.'
                : onlyTracked
                  ? 'Add wallets in Trackers, then filter this table to them.'
                  : 'Desk ranks only include Pointer fills seen on this mint (FIFO realized PnL).'
            }
          />
        </div>
      );
    }
    return (
      <div className="flex w-full min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-border-subtle/80 px-2 py-1.5">
          {TRADER_FILTER_OPTIONS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTraderDeskFilter(id)}
              className={cn(
                'btn-press inline-flex h-6 items-center rounded px-2 text-[10px] font-semibold uppercase tracking-wide transition-colors',
                traderDeskFilter === id
                  ? 'bg-fg-primary/12 text-fg-primary'
                  : 'text-fg-muted hover:bg-bg-hover hover:text-fg-secondary',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="desk-scroll-well min-h-0 flex-1 overflow-x-auto overflow-y-auto overscroll-y-auto rounded-b-[6px] border border-border-subtle/25 border-t-0 bg-bg-base/25 shadow-[inset_0_1px_0_rgb(var(--border-subtle-rgb)/0.45)] [scrollbar-gutter:stable] touch-pan-y [scrollbar-width:thin] [scrollbar-color:rgb(var(--border-strong-rgb)/0.65)_transparent]">
          <table className="w-full min-w-[720px] border-collapse text-left tabular-nums">
            <thead className="sticky top-0 z-[1] border-b border-border-subtle bg-bg-raised/95 text-left backdrop-blur-sm">
              <tr>
                <SortableTh className="w-9" align="center" sortGlyph={false}>
                  #
                </SortableTh>
                <SortableTh className="min-w-[168px]" align="left">
                  Wallet
                </SortableTh>
                <SortableTh className="w-[92px]" align="right">
                  <span className="block">Balance</span>
                  <span className="mt-0.5 block text-[10px] font-normal normal-case tracking-normal text-fg-muted">
                    Last
                  </span>
                </SortableTh>
                <SortableTh className="w-[118px]" align="right">
                  <span className="block">Bought</span>
                  <span className="mt-0.5 block text-[10px] font-normal normal-case tracking-normal text-fg-muted">
                    Avg · n
                  </span>
                </SortableTh>
                <SortableTh className="w-[118px]" align="right">
                  <span className="block">Sold</span>
                  <span className="mt-0.5 block text-[10px] font-normal normal-case tracking-normal text-fg-muted">
                    Avg · n
                  </span>
                </SortableTh>
                <SortableTh className="w-[92px]" align="right">
                  <span className="inline-flex items-center justify-end gap-0.5 normal-case">
                    <span className="text-[11px] uppercase tracking-wide">R. PnL</span>
                    <RealPnlInfoTooltip sym={sym} />
                  </span>
                </SortableTh>
                <SortableTh className="w-[72px]" align="right">
                  Held
                </SortableTh>
              </tr>
            </thead>
            <tbody>
              {displayRows.map((w, i) => {
                const pnl = w.realized_pnl_usd;
                const pnlTone =
                  pnl > 0
                    ? 'text-signal-bull'
                    : pnl < 0
                      ? 'text-signal-bear'
                      : 'text-fg-muted';
                const lastAct = w.last_trade_at ? formatAgeShort(w.last_trade_at) : '\u2014';
                const held =
                  w.held_seconds != null && w.held_seconds > 0 ? formatDuration(w.held_seconds) : '\u2014';
                const buyBar = maxBuy > 0 ? Math.min(100, (w.buy_usd / maxBuy) * 100) : 0;
                const sellBar = maxSell > 0 ? Math.min(100, (w.sell_usd / maxSell) * 100) : 0;
                const zebra = zebraDesk(i);
                return (
                  <tr
                    key={w.wallet_address}
                    className={cn(
                      'group cursor-pointer border-b border-border-subtle/35 transition-colors duration-100',
                      'hover:bg-bg-hover/35',
                      zebra,
                    )}
                  >
                    <td className="px-2.5 py-2 text-center align-middle text-[11px] font-medium tabular-nums text-fg-muted">
                      {i + 1}
                    </td>
                    <td className="min-w-[168px] px-2.5 py-2 align-middle">
                      <div className="flex min-w-0 items-center gap-1">
                        <Wallet
                          className="h-3 w-3 shrink-0 text-fg-muted opacity-70"
                          strokeWidth={2}
                        />
                        <div className="min-w-0 text-[12px] leading-tight">
                          <TopTraderWalletCell
                            mint={mint}
                            wallet={w.wallet_address}
                            sym={sym}
                            topTraderRow={w}
                            rank={i + 1}
                            creatorWallet={creatorWallet}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-2.5 py-2 text-right align-middle">
                      <div className="text-[11px] tabular-nums text-fg-muted">—</div>
                      <div className="mt-0.5 text-[10px] tabular-nums leading-none text-fg-muted">{lastAct}</div>
                    </td>
                    <td className="w-[118px] px-2.5 py-2 text-right align-middle">
                      <div className="text-[12px] font-medium tabular-nums leading-tight text-fg-primary">
                        {fmtUsdCell(w.buy_usd)}
                      </div>
                      <div className="mx-auto mt-1 h-px max-w-[4.5rem] overflow-hidden rounded-full bg-border-subtle">
                        <div
                          className="h-full rounded-full bg-signal-bull/45"
                          style={{ width: `${buyBar}%` }}
                        />
                      </div>
                      <div className="mt-0.5 text-right text-[10px] leading-tight text-fg-muted">
                        <span className="block opacity-90">
                          {formatNumber(w.buy_token_qty, { compact: true })} · {w.buy_count}
                        </span>
                        {w.avg_buy_usd_per_token != null ? (
                          <span className="block tabular-nums">
                            {tableUsd ? formatCompactUsd(w.avg_buy_usd_per_token) : '—'}
                          </span>
                        ) : (
                          <span className="block">—</span>
                        )}
                      </div>
                    </td>
                    <td className="w-[118px] px-2.5 py-2 text-right align-middle">
                      <div className="text-[12px] font-medium tabular-nums leading-tight text-fg-primary">
                        {fmtUsdCell(w.sell_usd)}
                      </div>
                      <div className="ml-auto mt-1 h-px max-w-[4.5rem] overflow-hidden rounded-full bg-border-subtle">
                        <div
                          className="h-full rounded-full bg-signal-bear/45"
                          style={{ width: `${sellBar}%` }}
                        />
                      </div>
                      <div className="mt-0.5 text-right text-[10px] leading-tight text-fg-muted">
                        <span className="block opacity-90">
                          {formatNumber(w.sell_token_qty, { compact: true })} · {w.sell_count}
                        </span>
                        {w.avg_sell_usd_per_token != null ? (
                          <span className="block tabular-nums">
                            {tableUsd ? formatCompactUsd(w.avg_sell_usd_per_token) : '—'}
                          </span>
                        ) : (
                          <span className="block">—</span>
                        )}
                      </div>
                    </td>
                    <td
                      className={cn(
                        'px-2.5 py-2 text-right align-middle text-[12px] font-semibold tabular-nums leading-tight',
                        pnlTone,
                      )}
                    >
                      {pnl >= 0 ? '+' : ''}
                      {tableUsd
                        ? formatCompactUsd(pnl)
                        : `${formatNumber(pnl / nativeUsdHint, { decimals: 2 })} ${nativeSym}`}
                    </td>
                    <td
                      className={cn(
                        'w-[72px] px-2.5 py-2 text-right align-middle text-[12px] tabular-nums leading-tight',
                        held === '\u2014' ? 'text-fg-muted' : 'text-fg-secondary',
                      )}
                    >
                      {held}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }, [
    tradersQ.data?.traders,
    tradersQ.isLoading,
    tradersQ.isError,
    uiDemo,
    tableDemoEnv,
    mint,
    sym,
    onlyTracked,
    traderDeskFilter,
    creatorWallet,
    resolveLabel,
    isTracked,
    tableUsd,
    nativeSym,
    nativeUsdHint,
  ]);

  const showTableControls = tab === 'traders' || tab === 'trades';

  const tabLabel = (t: (typeof TABS)[number]) => {
    if (t.id === 'holders') {
      if (preferTokenTableDemoRows()) return 'Holders (22)';
      const n = holdersQ.data?.holders.length;
      return n != null ? `Holders (${n})` : 'Holders';
    }
    if (t.id === 'dev_tokens' && dev && dev.tokens_launched > 0) {
      return `Dev Tokens (${dev.tokens_launched})`;
    }
    return t.label;
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col border-t border-border-subtle/30 bg-desk-panel/80 text-[12px] leading-snug text-fg-primary antialiased backdrop-blur-[1px]">
      <div className="flex shrink-0 flex-wrap items-center gap-x-1 gap-y-1 border-b border-border-subtle/35 px-2 py-0">
        <nav className="flex shrink-0 items-end gap-0" aria-label="Token activity">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  'btn-press relative inline-flex h-8 items-center px-2.5 pb-2 pt-1.5 text-[11px] font-semibold tracking-tight transition-colors',
                  active
                    ? 'text-fg-primary'
                    : 'text-fg-muted hover:text-fg-secondary',
                )}
                aria-current={active ? 'page' : undefined}
              >
                {active ? (
                  <span className="absolute inset-x-1.5 bottom-0 h-0.5 rounded-sm bg-accent-primary" />
                ) : null}
                <span className="relative z-[1]">{tabLabel(t)}</span>
              </button>
            );
          })}
        </nav>
        <div className="ml-1 flex flex-wrap items-center gap-1">
          {tab === 'orders' ? (
            <button
              type="button"
              className="btn-press h-6 px-1 text-[11px] font-semibold text-signal-bear/90 transition hover:text-signal-bear"
              onClick={() => {
                /* reserved for orderbook cancel-all API */
              }}
            >
              Cancel all
            </button>
          ) : null}
          {tab === 'traders' ? (
            <button
              type="button"
              onClick={() => setOnlyTracked((o) => !o)}
              className={cn(
                'btn-press inline-flex h-6 items-center rounded-md px-2 text-[11px] font-medium transition-colors',
                onlyTracked
                  ? 'bg-fg-primary/10 text-fg-primary'
                  : 'text-fg-muted hover:bg-bg-hover hover:text-fg-secondary',
              )}
            >
              Only Tracked
            </button>
          ) : null}
          {tab === 'trades' && tradesFeedHoverPause ? (
            <span className="inline-flex h-6 items-center rounded border border-signal-info/35 bg-signal-info/10 px-2 text-[10px] font-semibold uppercase tracking-wide text-signal-info">
              Paused
            </span>
          ) : null}
          {showTableControls ? (
            <>
              <label
                className="inline-flex h-6 cursor-pointer items-center gap-1.5 px-1 text-[11px] text-fg-muted hover:text-fg-secondary"
                title="Shows the compact live feed beside the chart. This bottom Trades desk stays visible — they are separate."
              >
                <input
                  type="checkbox"
                  checked={tradesPanel}
                  onChange={(e) => onTradesPanelChange(e.target.checked)}
                  className="h-3 w-3 rounded border-border-subtle bg-bg-raised"
                />
                Trades panel
              </label>
              <button
                type="button"
                onClick={() => setTableUsd((u) => !u)}
                className={cn(
                  'btn-press inline-flex h-6 items-center rounded-md px-2 text-[11px] font-semibold tabular-nums transition-colors',
                  tableUsd
                    ? 'bg-fg-primary/10 text-fg-primary'
                    : 'text-fg-muted hover:bg-bg-hover hover:text-fg-secondary',
                )}
              >
                USD
              </button>
            </>
          ) : null}
        </div>
        <div className="ml-auto flex items-center gap-2 py-1">
          {onOpenInstantTrade ? (
            <button
              type="button"
              onClick={onOpenInstantTrade}
              className="btn-press focus-ring inline-flex h-7 items-center gap-1.5 rounded-md bg-accent-primary px-2.5 text-[11px] font-semibold tracking-tight text-fg-inverse shadow-sm transition hover:brightness-110"
            >
              <Zap className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
              Instant
            </button>
          ) : null}
          <span className="text-[10px] tabular-nums uppercase tracking-wider text-fg-muted">
            {sym}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-x-4 border-b border-border-subtle/25 bg-bg-base/25 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-fg-muted backdrop-blur-sm">
        {tab === 'trades' ? <span>Global · live pool fills</span> : null}
        {tab === 'positions' ? <span>Your wallets · this mint</span> : null}
        {tab === 'orders' ? <span>Your open orders</span> : null}
        {tab === 'holders' ? <span>Holders · on-chain</span> : null}
        {tab === 'traders' ? <span>Desk · FIFO realized PnL</span> : null}
        {tab === 'dev_tokens' ? <span>Creator · deployer</span> : null}
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden w-full">
        {tab === 'trades' ? (
          tradesQ.isLoading && !tradesQ.data ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-7 w-full" />
              ))}
            </div>
          ) : tradeRowsForTable.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={Activity}
                title="No trades indexed yet"
                description="Activity fills in as users trade on Pointer."
              />
            </div>
          ) : (
            <MintTradesScroll
              rows={tradeRowsForTable}
              nativeSym={nativeSym}
              onHoverChange={setTradesFeedHoverPause}
            />
          )
        ) : null}
        {tab === 'positions' ? <PositionsDesk sym={sym} /> : null}
        {tab === 'orders' ? <OrdersDesk sym={sym} /> : null}
        {tab === 'holders' ? (
          <HoldersTable mint={mint} tokenSymbol={sym} creatorWallet={creatorWallet} />
        ) : null}
        {tab === 'traders' ? tradersBody : null}
        {tab === 'dev_tokens' ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-auto">
            <div className="border-b border-border-subtle p-2 text-[10px] text-fg-muted">
              Creator / deployer analytics for this token.
            </div>
            <DevSection creatorWallet={creatorWallet} mint={mint} tokenSymbol={sym} dev={dev} />
            <PlaceholderTab
              title="Dev token list"
              body="Cross-mint “dev wallet” history is not indexed yet; this tab reserves Axiom-style space."
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
