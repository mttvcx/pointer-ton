'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, BarChart3, Wallet, Zap } from 'lucide-react';
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
import type { MintTopTraderRow } from '@/lib/trading/mintTopTraders';

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
    <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
      <p className="text-[12px] font-semibold text-[#d1d5db]">{title}</p>
      <p className="max-w-sm text-[11px] leading-snug text-[#6b7280]">{body}</p>
    </div>
  );
}

export function TokenActivityTabs({
  mint,
  symbol,
  creatorWallet,
  dev,
  onOpenInstantTrade,
}: {
  mint: string;
  symbol: string | null;
  creatorWallet: string | null;
  dev: DevWalletStatsRow | null;
  onOpenInstantTrade?: () => void;
}) {
  const [tab, setTab] = useState<TabId>('trades');
  const [onlyTracked, setOnlyTracked] = useState(false);
  const [tradesPanel, setTradesPanel] = useState(true);
  const [tableUsd, setTableUsd] = useState(true);
  const uiDemo = useUiDemoMode();
  const { isTracked } = useTrackedWalletsLookup();

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
    const raw = tradesQ.data?.trades ?? [];
    const showSynthetic =
      uiDemo && !tradesQ.isLoading && (raw.length === 0 || tradesQ.isError);
    const rows = showSynthetic ? syntheticTradesForMint(mint) : raw;
    if (rows.length === 0) {
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
      <div className="h-full min-h-0 overflow-auto">
        <table className="w-full border-collapse text-left text-[10px]">
          <thead className="sticky top-0 z-[1] bg-[#0b0d12] text-[#6b7280]">
            <tr className="border-b border-[#1b1f2a]">
              <th className="px-2 py-1.5 font-semibold uppercase tracking-wide">Time</th>
              <th className="px-2 py-1.5 font-semibold uppercase tracking-wide">Side</th>
              <th className="px-2 py-1.5 text-right font-semibold uppercase tracking-wide">
                {tableUsd ? 'SOL' : 'SOL'}
              </th>
              <th className="px-2 py-1.5 text-right font-semibold uppercase tracking-wide">Px</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t, i) => (
              <tr
                key={t.id}
                className={cn(
                  'border-b border-[#1b1f2a]/80',
                  i % 2 === 1 ? 'bg-[#0f1219]' : 'bg-transparent',
                )}
              >
                <td className="px-2 py-1.5 tabular-nums text-[#9ca3af]">
                  {formatRelativeTime(t.submitted_at)}
                </td>
                <td className="px-2 py-1.5">
                  <span
                    className={cn(
                      'font-semibold uppercase',
                      t.side === 'buy' ? 'text-[#34d399]' : 'text-[#fb7185]',
                    )}
                  >
                    {t.side}
                  </span>
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums text-[#f3f4f6]">
                  {t.amount_sol != null ? formatNumber(t.amount_sol, { decimals: 4 }) : '\u2014'}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums text-[#9ca3af]">
                  {t.price_usd_at_fill != null
                    ? tableUsd
                      ? `$${formatNumber(t.price_usd_at_fill, { decimals: 4 })}`
                      : `${formatNumber(t.price_usd_at_fill / 150, { decimals: 6 })} SOL`
                    : '\u2014'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }, [tradesQ.data?.trades, tradesQ.isLoading, tradesQ.isError, uiDemo, mint, tableUsd]);

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
    const displayRows = onlyTracked ? rows.filter((w) => isTracked(w.wallet_address)) : rows;
    const maxBuy = displayRows.reduce((m, w) => Math.max(m, w.buy_usd), 0);
    const maxSell = displayRows.reduce((m, w) => Math.max(m, w.sell_usd), 0);
    const fmtUsdCell = (v: number) =>
      tableUsd ? formatCompactUsd(v) : `${formatNumber(v / 150, { decimals: 4 })} SOL`;

    if (displayRows.length === 0) {
      return (
        <div className="p-4">
          <EmptyState
            icon={BarChart3}
            title={onlyTracked ? 'No tracked traders here' : 'No ranked traders'}
            description={
              onlyTracked
                ? 'Add wallets in Trackers, then filter this table to them.'
                : 'Ranks appear once we have confirmed in-app trades on this mint.'
            }
          />
        </div>
      );
    }
    return (
      <div className="h-full min-h-0 overflow-auto">
        <p className="border-b border-[#1b1f2a] px-2 py-1.5 text-[9px] leading-snug text-[#6b7280]">
          <span className="font-semibold text-[#9ca3af]">R. PnL</span> on{' '}
          <span className="font-semibold text-[#d1d5db]">{sym}</span> — confirmed Pointer fills, FIFO. Not
          platform-wide.
        </p>
        <div className="overflow-x-auto">
          <table className="min-w-[56rem] w-full border-collapse text-left text-[9px]">
            <thead className="sticky top-0 z-[1] bg-[#0b0d12] text-[#6b7280]">
              <tr className="border-b border-[#1b1f2a]">
                <th className="w-7 px-1 py-1 text-center font-semibold uppercase">#</th>
                <th className="min-w-[7.5rem] px-1.5 py-1 font-semibold uppercase tracking-wide">
                  Wallet
                </th>
                <th className="min-w-[6.5rem] px-1.5 py-1 font-semibold uppercase leading-tight tracking-wide">
                  <span className="block">SOL Balance</span>
                  <span className="block text-[8px] font-normal capitalize opacity-80">(Last Active)</span>
                </th>
                <th className="min-w-[7.5rem] px-1.5 py-1 font-semibold uppercase leading-tight tracking-wide">
                  <span className="block">Bought</span>
                  <span className="block text-[8px] font-normal capitalize opacity-80">(Avg Buy)</span>
                </th>
                <th className="min-w-[7.5rem] px-1.5 py-1 font-semibold uppercase leading-tight tracking-wide">
                  <span className="block">Sold</span>
                  <span className="block text-[8px] font-normal capitalize opacity-80">(Avg Sell)</span>
                </th>
                <th className="min-w-[4rem] px-1.5 py-1 font-semibold uppercase tracking-wide">R. PnL</th>
                <th className="min-w-[5rem] px-1.5 py-1 font-semibold uppercase tracking-wide">Remaining</th>
                <th className="min-w-[4rem] px-1.5 py-1 font-semibold uppercase tracking-wide">Funding</th>
                <th className="min-w-[3.25rem] px-1.5 py-1 text-right font-semibold uppercase tracking-wide">
                  Held
                </th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map((w, i) => {
                const pnl = w.realized_pnl_usd;
                const pnlTone =
                  pnl > 0 ? 'text-[#34d399]' : pnl < 0 ? 'text-[#fb7185]' : 'text-[#9ca3af]';
                const lastAct = w.last_trade_at ? formatAgeShort(w.last_trade_at) : '\u2014';
                const held =
                  w.held_seconds != null && w.held_seconds > 0 ? formatDuration(w.held_seconds) : '\u2014';
                const buyBar = maxBuy > 0 ? Math.min(100, (w.buy_usd / maxBuy) * 100) : 0;
                const sellBar = maxSell > 0 ? Math.min(100, (w.sell_usd / maxSell) * 100) : 0;
                return (
                  <tr
                    key={w.wallet_address}
                    className={cn(
                      'border-b border-[#1b1f2a]/80',
                      i % 2 === 1 ? 'bg-[#0f1219]' : '',
                    )}
                  >
                    <td className="px-1 py-1 text-center tabular-nums text-[#6b7280]">{i + 1}</td>
                    <td className="px-1.5 py-1 align-top">
                      <div className="flex items-start gap-0.5">
                        <Wallet className="mt-0.5 h-3 w-3 shrink-0 text-[#4b5563]" strokeWidth={2} />
                        <div className="min-w-0">
                          <TopTraderWalletCell mint={mint} wallet={w.wallet_address} sym={sym} />
                        </div>
                      </div>
                    </td>
                    <td className="px-1.5 py-1 align-top tabular-nums leading-tight text-[#9ca3af]">
                      <div className="flex flex-wrap items-baseline gap-x-1">
                        <span className="text-[#4b5563]">{'\u2014'}</span>
                        <span className="text-[#6b7280]">({lastAct})</span>
                      </div>
                    </td>
                    <td className="px-1.5 py-1 align-top leading-tight">
                      <div className="font-semibold tabular-nums text-[#34d399]">{fmtUsdCell(w.buy_usd)}</div>
                      <div className="mt-0.5 h-1 w-full max-w-[5rem] overflow-hidden rounded-full bg-[#1b1f2a]">
                        <div
                          className="h-full rounded-full bg-[#34d399]"
                          style={{ width: `${buyBar}%` }}
                        />
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-baseline justify-between gap-x-1 text-[8px] text-[#6b7280]">
                        <span>
                          {formatNumber(w.buy_token_qty, { compact: true })} / {w.buy_count}
                        </span>
                        <span className="shrink-0 text-[#34d399]">
                          {w.avg_buy_usd_per_token != null
                            ? `(${tableUsd ? formatCompactUsd(w.avg_buy_usd_per_token) : '—'})`
                            : '\u2014'}
                        </span>
                      </div>
                    </td>
                    <td className="px-1.5 py-1 align-top leading-tight">
                      <div className="font-semibold tabular-nums text-[#fb7185]">{fmtUsdCell(w.sell_usd)}</div>
                      <div className="mt-0.5 h-1 w-full max-w-[5rem] overflow-hidden rounded-full bg-[#1b1f2a]">
                        <div
                          className="h-full rounded-full bg-[#fb7185]/90"
                          style={{ width: `${sellBar}%` }}
                        />
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-baseline justify-between gap-x-1 text-[8px] text-[#6b7280]">
                        <span>
                          {formatNumber(w.sell_token_qty, { compact: true })} / {w.sell_count}
                        </span>
                        <span className="shrink-0 text-[#fb7185]">
                          {w.avg_sell_usd_per_token != null
                            ? `(${tableUsd ? formatCompactUsd(w.avg_sell_usd_per_token) : '—'})`
                            : '\u2014'}
                        </span>
                      </div>
                    </td>
                    <td
                      className={cn(
                        'px-1.5 py-1 align-top text-right text-[9px] font-semibold tabular-nums',
                        pnlTone,
                      )}
                    >
                      {pnl >= 0 ? '+' : ''}
                      {tableUsd ? formatCompactUsd(pnl) : `${formatNumber(pnl / 150, { decimals: 2 })} SOL`}
                    </td>
                    <td className="px-1.5 py-1 align-top leading-tight text-[#9ca3af]">
                      <div className="tabular-nums">{'\u2014'}</div>
                      <div className="mt-0.5 h-1 w-full max-w-[4.5rem] rounded-full bg-[#1b1f2a]" />
                      <div className="mt-0.5 text-[8px] text-[#4b5563]">{'\u2014'}</div>
                    </td>
                    <td className="px-1.5 py-1 align-top text-[#6b7280]">{'\u2014'}</td>
                    <td className="px-1.5 py-1 text-right align-top tabular-nums text-[#9ca3af]">
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
  }, [tradersQ.data?.traders, tradersQ.isLoading, tradersQ.isError, uiDemo, mint, sym, onlyTracked, isTracked, tableUsd]);

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
    <div
      className="flex h-full min-h-0 flex-col border-t border-[#1b1f2a] bg-[#0b0d12] font-sans text-[12px]"
     
    >
      <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-[#1b1f2a] px-2 py-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'btn-press rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-wide transition-all duration-150',
              tab === t.id
                ? 'bg-white/10 text-[#f9fafb]'
                : 'text-[#6b7280] hover:text-[#d1d5db]',
            )}
          >
            {tabLabel(t)}
          </button>
        ))}
        {tab === 'traders' ? (
          <button
            type="button"
            onClick={() => setOnlyTracked((o) => !o)}
            className={cn(
              'btn-press rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide transition-all',
              onlyTracked
                ? 'border-[#38bdf8]/40 bg-[#38bdf8]/10 text-[#7dd3fc]'
                : 'border-[#1b1f2a] text-[#6b7280] hover:border-[#2d3548]',
            )}
          >
            Only Tracked
          </button>
        ) : null}
        {showTableControls ? (
          <>
            <label className="ml-1 flex cursor-pointer items-center gap-1 text-[10px] text-[#6b7280]">
              <input
                type="checkbox"
                checked={tradesPanel}
                onChange={(e) => setTradesPanel(e.target.checked)}
                className="h-3 w-3 rounded border-[#1b1f2a]"
              />
              Trades Panel
            </label>
            <button
              type="button"
              onClick={() => setTableUsd((u) => !u)}
              className={cn(
                'rounded-full border px-2 py-0.5 tabular-nums text-[10px] font-semibold',
                tableUsd
                  ? 'border-[#38bdf8]/40 text-[#7dd3fc]'
                  : 'border-[#1b1f2a] text-[#6b7280]',
              )}
            >
              USD
            </button>
          </>
        ) : null}
        <div className="ml-auto flex items-center gap-1.5">
          {onOpenInstantTrade ? (
            <button
              type="button"
              onClick={onOpenInstantTrade}
              className="btn-press focus-ring inline-flex items-center gap-1 rounded-md bg-[#6366f1] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white shadow-md transition hover:brightness-110"
            >
              <Zap className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
              Instant Trade
            </button>
          ) : null}
          <span className="text-[9px] tabular-nums text-[#4b5563]">{sym}</span>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
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
        {tab === 'holders' ? <HoldersTable mint={mint} /> : null}
        {tab === 'traders' ? tradersBody : null}
        {tab === 'dev_tokens' ? (
          <div className="h-full min-h-0 overflow-auto">
            <div className="border-b border-[#1b1f2a] p-2 text-[10px] text-[#6b7280]">
              Creator / deployer analytics for this token.
            </div>
            <DevSection creatorWallet={creatorWallet} dev={dev} />
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
