'use client';

import { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, ArrowUpDown, BarChart3, HelpCircle, Wallet, Zap } from 'lucide-react';
import type { AppChainId } from '@/lib/chains/appChain';
import { nativeTicker } from '@/lib/chains/nativeCurrency';
import { formatCompactUsd, formatDuration, formatNumber, formatRelativeTime, formatAgeShort } from '@/lib/utils/formatters';
import type { Tables } from '@/lib/supabase/types';
import type { DevWalletStatsRow } from '@/lib/db/wallets';
import { cn } from '@/lib/utils/cn';
import { HoldersTable } from '@/components/tokens/HoldersTable';
import { DevSection } from '@/components/tokens/DevSection';
import { TopTraderWalletCell } from '@/components/tokens/TopTraderWalletCell';
import { EmptyState } from '@/components/shared/EmptyState';
import { Skeleton } from '@/components/shared/Skeleton';
import { syntheticTradesForMint, syntheticTopTradersForMint } from '@/lib/dev/demoTokenFixtures';
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

const TABS: { id: TabId; label: string }[] = [
  { id: 'trades', label: 'Trades' },
  { id: 'positions', label: 'Positions' },
  { id: 'orders', label: 'Orders' },
  { id: 'holders', label: 'Holders' },
  { id: 'traders', label: 'Top Traders' },
  { id: 'dev_tokens', label: 'Dev Tokens' },
];

function PlaceholderTab({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex min-h-[12rem] flex-col items-center justify-center gap-2 p-8 text-center">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="max-w-sm text-xs leading-snug text-muted-foreground">{body}</p>
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
        'group/th px-3 py-2 align-middle font-medium leading-tight',
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
        className="h-3 w-3 cursor-help text-muted-foreground/70 transition-colors group-hover/info:text-foreground"
        strokeWidth={2}
      />
      <span
        role="tooltip"
        className="pointer-events-none absolute right-0 top-full z-20 mt-1.5 w-64 rounded-md border border-border/60 bg-background/95 px-2.5 py-2 text-[11px] font-normal normal-case leading-snug tracking-normal text-muted-foreground opacity-0 shadow-lg backdrop-blur transition-opacity duration-100 group-hover/info:opacity-100 group-focus-within/info:opacity-100"
      >
        <span className="font-semibold text-foreground">Realized PnL</span> ranks wallets on{' '}
        <span className="font-semibold text-foreground">{sym}</span> only (Pointer fills · FIFO desk). Same
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

  const tradeRowsForTable = useMemo((): TradeRow[] => {
    if (tradesQ.isLoading && !tradesQ.data) return [];
    const raw = tradesQ.data?.trades ?? [];
    const showSynthetic =
      uiDemo && !tradesQ.isLoading && tradesQ.data != null && (raw.length === 0 || tradesQ.isError);
    return showSynthetic ? syntheticTradesForMint(mint) : raw;
  }, [tradesQ.data, tradesQ.isLoading, tradesQ.isError, uiDemo, mint]);

  useEffect(() => {
    onLiveTradesSnapshot?.({
      rows: tradeRowsForTable,
      isLoading: tradesQ.isLoading,
    });
  }, [tradeRowsForTable, tradesQ.isLoading, onLiveTradesSnapshot]);

  const activityBody = useMemo(() => {
    if (tradesQ.isLoading) {
      return (
        <div className="space-y-2 p-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-full" />
          ))}
        </div>
      );
    }
    if (tradeRowsForTable.length === 0) {
      return (
        <div className="p-4">
          <EmptyState
            icon={Activity}
            title="No trades indexed yet"
            description="Activity fills in as users trade on Pointer."
          />
        </div>
      );
    }
    return (
      <div className="w-full">
        <table className="w-full border-collapse text-left text-xs tabular-nums">
          <thead className="sticky top-0 z-[1] border-b border-border/50 bg-muted/20 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Time</th>
              <th className="px-3 py-2 font-medium">Side</th>
              <th className="px-3 py-2 text-right font-medium">{nativeSym}</th>
              <th className="px-3 py-2 text-right font-medium">Px</th>
            </tr>
          </thead>
          <tbody>
            {tradeRowsForTable.map((t) => (
              <tr
                key={t.id}
                className="cursor-pointer border-b border-border/40 transition-colors duration-100 even:bg-muted/5 hover:bg-muted/30"
              >
                <td className="px-3 py-2 align-middle text-muted-foreground">
                  {formatRelativeTime(t.submitted_at)}
                </td>
                <td className="px-3 py-2 align-middle">
                  <span
                    className={cn(
                      'font-medium capitalize',
                      t.side === 'buy' ? 'text-emerald-400' : 'text-rose-400',
                    )}
                  >
                    {t.side}
                  </span>
                </td>
                <td className="px-3 py-2 text-right align-middle text-foreground">
                  {t.amount_sol != null ? formatNumber(t.amount_sol, { decimals: 4 }) : '\u2014'}
                </td>
                <td className="px-3 py-2 text-right align-middle text-muted-foreground">
                  {t.price_usd_at_fill != null
                    ? tableUsd
                      ? `$${formatNumber(t.price_usd_at_fill, { decimals: 4 })}`
                      : `${formatNumber(t.price_usd_at_fill / nativeUsdHint, { decimals: 6 })} ${nativeSym}`
                    : '\u2014'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }, [tradeRowsForTable, tradesQ.isLoading, tableUsd, nativeSym, nativeUsdHint]);

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
      uiDemo && !tradersQ.isLoading && (raw.length === 0 || tradersQ.isError);
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
      <div className="w-full">
        <div className="flex flex-wrap items-center gap-1 border-b border-border-subtle px-3 pb-2">
          {TRADER_FILTER_OPTIONS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTraderDeskFilter(id)}
              className={cn(
                'btn-press inline-flex h-6 items-center rounded border px-2 text-[10px] font-medium uppercase tracking-wide transition-colors',
                traderDeskFilter === id
                  ? 'border-border bg-bg-hover text-fg-primary'
                  : 'border-border-subtle bg-transparent text-fg-muted hover:bg-bg-hover',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-0 border-collapse text-left tabular-nums">
            <thead className="sticky top-0 z-[1] border-b border-border-subtle bg-bg-sunken text-[10px] font-medium uppercase tracking-wider text-fg-muted">
              <tr>
                <SortableTh className="w-10" align="center" sortGlyph={false}>
                  #
                </SortableTh>
                <SortableTh className="min-w-[180px]" align="left">
                  Wallet
                </SortableTh>
                <SortableTh className="w-[100px]" align="right">
                  <span className="block">{nativeSym} balance</span>
                  <span className="mt-px block font-mono text-[10px] font-normal normal-case tracking-normal text-fg-muted">
                    Last active
                  </span>
                </SortableTh>
                <SortableTh className="w-[130px]" align="right">
                  <span className="block">Bought</span>
                  <span className="mt-px block font-mono text-[10px] font-normal normal-case tracking-normal text-fg-muted">
                    Avg buy
                  </span>
                </SortableTh>
                <SortableTh className="w-[130px]" align="right">
                  <span className="block">Sold</span>
                  <span className="mt-px block font-mono text-[10px] font-normal normal-case tracking-normal text-fg-muted">
                    Avg sell
                  </span>
                </SortableTh>
                <SortableTh className="w-[100px]" align="right">
                  <span className="inline-flex items-center justify-end gap-1 normal-case">
                    <span className="uppercase tracking-wider">Real. PnL</span>
                    <RealPnlInfoTooltip sym={sym} />
                  </span>
                </SortableTh>
                <SortableTh className="w-[90px]" align="right">
                  Remaining
                </SortableTh>
                <SortableTh className="w-[90px]" align="right">
                  Funding
                </SortableTh>
                <SortableTh className="w-[90px]" align="right">
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
                return (
                  <tr
                    key={w.wallet_address}
                    className={cn(
                      'group h-11 cursor-pointer border-b border-border-subtle bg-bg-raised transition-colors duration-100',
                      'hover:bg-bg-hover last:border-b-0',
                    )}
                  >
                    <td className="px-3 text-center align-middle font-mono text-xs tabular-nums text-fg-muted">
                      {i + 1}
                    </td>
                    <td className="min-w-[180px] px-3 align-middle">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <Wallet
                          className="h-3.5 w-3.5 shrink-0 text-fg-muted"
                          strokeWidth={2}
                        />
                        <div className="min-w-0">
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
                    <td className="px-3 text-right align-middle">
                      <div className="font-mono text-xs tabular-nums text-fg-muted">{'\u2014'}</div>
                      <div className="mt-px font-mono text-[10px] text-fg-muted">{lastAct}</div>
                    </td>
                    <td className="w-[130px] px-3 text-right align-middle">
                      <div className="font-mono text-xs tabular-nums text-fg-primary">{fmtUsdCell(w.buy_usd)}</div>
                      <div className="mx-auto mt-1 h-0.5 w-[4.75rem] max-w-full overflow-hidden rounded-full bg-muted/40">
                        <div
                          className="h-full rounded-full bg-emerald-500/40"
                          style={{ width: `${buyBar}%` }}
                        />
                      </div>
                      <div className="mt-1 text-right font-mono text-[10px] leading-snug text-fg-muted">
                        <span className="block">
                          {formatNumber(w.buy_token_qty, { compact: true })} / {w.buy_count}
                        </span>
                        {w.avg_buy_usd_per_token != null ? (
                          <span className="block">
                            {tableUsd ? formatCompactUsd(w.avg_buy_usd_per_token) : '—'}
                          </span>
                        ) : (
                          <span className="block">{'—'}</span>
                        )}
                      </div>
                    </td>
                    <td className="w-[130px] px-3 text-right align-middle">
                      <div className="font-mono text-xs tabular-nums text-fg-primary">{fmtUsdCell(w.sell_usd)}</div>
                      <div className="ml-auto mt-1 h-0.5 w-[4.75rem] max-w-full overflow-hidden rounded-full bg-muted/40">
                        <div
                          className="h-full rounded-full bg-rose-500/40"
                          style={{ width: `${sellBar}%` }}
                        />
                      </div>
                      <div className="mt-1 text-right font-mono text-[10px] leading-snug text-fg-muted">
                        <span className="block">
                          {formatNumber(w.sell_token_qty, { compact: true })} / {w.sell_count}
                        </span>
                        {w.avg_sell_usd_per_token != null ? (
                          <span className="block">
                            {tableUsd ? formatCompactUsd(w.avg_sell_usd_per_token) : '—'}
                          </span>
                        ) : (
                          <span className="block">{'—'}</span>
                        )}
                      </div>
                    </td>
                    <td
                      className={cn(
                        'px-3 text-right align-middle font-mono text-xs tabular-nums',
                        pnlTone,
                      )}
                    >
                      {pnl >= 0 ? '+' : ''}
                      {tableUsd
                        ? formatCompactUsd(pnl)
                        : `${formatNumber(pnl / nativeUsdHint, { decimals: 2 })} ${nativeSym}`}
                    </td>
                    <td className="w-[90px] px-3 text-right align-middle">
                      <div className="font-mono text-xs tabular-nums text-fg-muted">{'\u2014'}</div>
                      <div className="mt-px font-mono text-[10px] text-fg-muted">{'\u2014'}</div>
                    </td>
                    <td className="w-[90px] px-3 text-right align-middle font-mono text-xs tabular-nums text-fg-muted">
                      {'\u2014'}
                    </td>
                    <td
                      className={cn(
                        'w-[90px] px-3 text-right align-middle font-mono text-xs tabular-nums',
                        held === '\u2014' ? 'text-fg-muted' : 'text-fg-primary',
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
      const n = holdersQ.data?.holders.length;
      return n != null ? `Holders (${n})` : 'Holders';
    }
    if (t.id === 'dev_tokens' && dev && dev.tokens_launched > 0) {
      return `Dev Tokens (${dev.tokens_launched})`;
    }
    return t.label;
  };

  return (
    <div className="flex flex-col border-t border-border bg-background font-sans text-sm">
      <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-border/60 px-3">
        <nav className="flex shrink-0 items-stretch gap-1" aria-label="Token activity">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  'btn-press relative inline-flex h-9 items-center px-3 text-xs font-medium tracking-tight transition-colors',
                  active
                    ? 'text-foreground after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-t-sm after:bg-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                aria-current={active ? 'page' : undefined}
              >
                {tabLabel(t)}
              </button>
            );
          })}
        </nav>
        <div className="ml-2 flex flex-wrap items-center gap-1.5">
          {tab === 'traders' ? (
            <button
              type="button"
              onClick={() => setOnlyTracked((o) => !o)}
              className={cn(
                'btn-press inline-flex h-7 items-center rounded-md px-2.5 text-xs font-medium transition-colors',
                onlyTracked
                  ? 'bg-muted/60 text-foreground'
                  : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground',
              )}
            >
              Only Tracked
            </button>
          ) : null}
          {showTableControls ? (
            <>
              <label className="inline-flex h-7 cursor-pointer items-center gap-1.5 px-1.5 text-xs text-muted-foreground hover:text-foreground">
                <input
                  type="checkbox"
                  checked={tradesPanel}
                  onChange={(e) => onTradesPanelChange(e.target.checked)}
                  className="h-3 w-3 rounded border-border bg-background"
                />
                Trades Panel
              </label>
              <button
                type="button"
                onClick={() => setTableUsd((u) => !u)}
                className={cn(
                  'btn-press inline-flex h-7 items-center rounded-md px-2.5 text-xs font-semibold tabular-nums transition-colors',
                  tableUsd
                    ? 'bg-muted/60 text-foreground'
                    : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground',
                )}
              >
                USD
              </button>
            </>
          ) : null}
        </div>
        <div className="ml-auto flex items-center gap-2 py-1.5">
          {onOpenInstantTrade ? (
            <button
              type="button"
              onClick={onOpenInstantTrade}
              className="btn-press focus-ring inline-flex h-8 items-center gap-1.5 rounded-md bg-accent-primary px-3 text-xs font-semibold tracking-tight text-fg-inverse shadow-sm transition hover:brightness-110"
            >
              <Zap className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
              Instant Trade
            </button>
          ) : null}
          <span className="text-[10px] tabular-nums uppercase tracking-wider text-muted-foreground/70">
            {sym}
          </span>
        </div>
      </div>
      <div className="w-full">
        {tab === 'trades' ? (
          tradesPanel ? (
            activityBody
          ) : (
            <PlaceholderTab
              title="Trades panel hidden"
              body="Enable “Trades Panel” to show the live fills table."
            />
          )
        ) : null}
        {tab === 'positions' ? (
          <PlaceholderTab
            title="Positions"
            body="Per-wallet positions and PnL for this mint will appear when portfolio v2 lands."
          />
        ) : null}
        {tab === 'orders' ? (
          <PlaceholderTab
            title="Orders"
            body="Open limit / TWAP orders on this mint will appear here in a future release."
          />
        ) : null}
        {tab === 'holders' ? (
          <HoldersTable mint={mint} tokenSymbol={sym} creatorWallet={creatorWallet} />
        ) : null}
        {tab === 'traders' ? tradersBody : null}
        {tab === 'dev_tokens' ? (
          <div className="w-full">
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
