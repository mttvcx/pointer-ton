'use client';

import { useMemo } from 'react';
import { ArrowLeftRight, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import {
  formatRelativeShort,
  formatTradeClockTime,
  formatCompactUsd,
  formatCompactNumber,
} from '@/lib/format';
import {
  tradeFillMcUsdLabel,
  tradeTraderHint,
  tradeWalletDeskExtras,
  tradeRowDemoIndex,
} from '@/lib/tokens/tradeFormatting';
import {
  DESK_CELL_CLASS,
  DESK_CELL_FIRST_CLASS,
  DESK_HEADER_CLASS,
  DESK_HEADER_NUM_CLASS,
  DESK_ROW_CLASS,
  DESK_STICKY_HEAD_CLASS,
  DESK_TABLE_CLASS,
  CELL_MUTED_CLASS,
  CELL_WALLET_CLASS,
} from './cells/deskTokens';
import { InlineBarCell } from './cells/InlineBarCell';
import { SortableTh, SortIndicator } from './cells/SortableTh';
import { DeskHeaderSettings } from './cells/DeskHeaderSettings';
import { WalletIdentityAnchor } from '@/components/wallet/identity/WalletIdentityAnchor';
import { WalletMintTradesFilterButton } from './cells/WalletMintTradesFilterButton';
import { ChainIcon } from '@/components/squads/ChainIcon';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { explorerAddressUrl } from '@/lib/utils/addresses';
import type { Tables } from '@/lib/supabase/types';

type TradeRow = Tables<'trades'>;

type Props = {
  rows: TradeRow[];
  mint: string;
  tokenSymbol?: string | null;
  creatorWallet?: string | null;
  displayMode: 'USD' | 'SOL';
  nativeSym?: string;
  onFilterMintTrades?: (address: string) => void;
  tradesMakerFilter?: string | null;
  onToggleDisplayMode?: () => void;
  ageSortDir: 'asc' | 'desc';
  onAgeSortDirChange: (dir: 'asc' | 'desc') => void;
  ageDisplay: 'age' | 'time';
  onAgeDisplayChange: (mode: 'age' | 'time') => void;
};

export function MintTradesTable({
  rows,
  mint,
  tokenSymbol,
  creatorWallet = null,
  displayMode,
  nativeSym = 'SOL',
  onFilterMintTrades,
  tradesMakerFilter,
  onToggleDisplayMode,
  ageSortDir,
  onAgeSortDirChange,
  ageDisplay,
  onAgeDisplayChange,
}: Props) {
  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      const ta = new Date(a.submitted_at).getTime();
      const tb = new Date(b.submitted_at).getTime();
      if (!Number.isFinite(ta) || !Number.isFinite(tb)) return 0;
      return ageSortDir === 'asc' ? ta - tb : tb - ta;
    });
  }, [rows, ageSortDir]);

  const { maxSol, maxUsd } = useMemo(() => {
    let s = 0;
    let u = 0;
    for (const r of rows) {
      const sol = Math.abs(r.amount_sol ?? 0);
      const usd = sol * Math.abs(r.price_usd_at_fill ?? 0);
      if (sol > s) s = sol;
      if (usd > u) u = usd;
    }
    return { maxSol: s || 1, maxUsd: u || 1 };
  }, [rows]);

  return (
    <table className={cn('w-full table-fixed border-collapse', DESK_TABLE_CLASS)}>
      <colgroup>
        <col className="w-[56px]" />
        <col className="w-[60px]" />
        <col className="w-[80px]" />
        <col className="w-[100px]" />
        <col className="w-[140px]" />
        <col className="w-[1%]" />
        <col className="w-[28px]" />
      </colgroup>
      <thead className={DESK_STICKY_HEAD_CLASS}>
        <tr>
          <th className={cn(DESK_HEADER_CLASS, 'text-right pl-3')}>
            <span className="inline-flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => onAgeDisplayChange('age')}
                className={cn(
                  'rounded px-0.5 transition-colors',
                  ageDisplay === 'age' ? 'text-fg-primary' : 'text-fg-muted/60 hover:text-fg-secondary',
                )}
              >
                Age
              </button>
              <button
                type="button"
                onClick={() => onAgeSortDirChange(ageSortDir === 'desc' ? 'asc' : 'desc')}
                className="inline-flex items-center rounded px-0.5 text-fg-muted/60 transition-colors hover:text-fg-primary"
                aria-label={`Sort trades by time, ${ageSortDir === 'desc' ? 'newest first' : 'oldest first'}`}
                title={`Sort ${ageSortDir === 'desc' ? 'newest first' : 'oldest first'}`}
              >
                <SortIndicator sortDir={ageSortDir} />
              </button>
              <span className="text-fg-muted/40">/</span>
              <button
                type="button"
                onClick={() => onAgeDisplayChange('time')}
                className={cn(
                  'rounded px-0.5 transition-colors',
                  ageDisplay === 'time' ? 'text-fg-primary' : 'text-fg-muted/60 hover:text-fg-secondary',
                )}
              >
                Time
              </button>
            </span>
          </th>
          <th className={DESK_HEADER_CLASS}>Type</th>
          <SortableTh label="MC" align="right" />
          <SortableTh
            label={
              <span className="flex flex-col items-end gap-0 leading-none">
                <span>Amount</span>
                {onToggleDisplayMode ? (
                  <button
                    type="button"
                    onClick={onToggleDisplayMode}
                    className="mt-0.5 inline-flex items-center gap-0.5 text-[9px] font-normal normal-case tracking-normal text-fg-muted/60 transition hover:text-fg-primary"
                    title="Toggle USD / SOL"
                  >
                    {displayMode === 'SOL' ? nativeSym : 'USD'}
                    <span className="inline-flex h-3 w-3 items-center justify-center rounded-full bg-signal-bull/15 text-signal-bull">
                      <ArrowLeftRight className="h-2 w-2" strokeWidth={2.5} aria-hidden />
                    </span>
                  </button>
                ) : (
                  <span className="mt-0.5 text-[9px] font-normal normal-case tracking-normal text-fg-muted/60">
                    {displayMode === 'SOL' ? nativeSym : 'USD'}
                  </span>
                )}
              </span>
            }
            align="right"
          />
          <th className={DESK_HEADER_NUM_CLASS}>
            <span className="ml-auto inline-flex items-center gap-1">
              {displayMode === 'SOL' ? (
                <>
                  Total {nativeSym}
                  <ChainIcon chain="sol" size={12} />
                </>
              ) : (
                'Total USD'
              )}
            </span>
          </th>
          <th className={cn(DESK_HEADER_CLASS, 'min-w-[200px] text-right')}>Trader</th>
          <DeskHeaderSettings />
        </tr>
      </thead>
      <tbody>
        {sortedRows.map((row, i) => {
          const tone = row.side === 'buy' ? 'buy' : 'sell';
          const sol = row.amount_sol ?? 0;
          const tokens = row.amount_token ?? 0;
          const traderHint = tradeTraderHint(row, i);
          const usdValue = Math.abs(sol * (row.price_usd_at_fill ?? 0));
          const totalBarValue = displayMode === 'SOL' ? Math.abs(sol) : usdValue;
          const totalBarMax = displayMode === 'SOL' ? maxSol : maxUsd;
          const solDisplay = sol.toFixed(Math.abs(sol) < 1 ? 3 : 2);
          const sizeClass =
            usdValue >= 50_000
              ? 'text-[14px] font-bold'
              : usdValue >= 10_000
                ? 'text-[13px] font-semibold'
                : usdValue >= 1_000
                  ? 'text-[12px] font-medium'
                  : 'text-[11px] font-normal';

          const wallet = traderHint.fullAddress;
          const demoIdx = tradeRowDemoIndex(row);
          const deskExtras = wallet
            ? tradeWalletDeskExtras(wallet, demoIdx, creatorWallet)
            : null;

          return (
            <tr key={row.id} className={DESK_ROW_CLASS}>
              <td className={cn(DESK_CELL_FIRST_CLASS, 'text-right')}>
                <span className={CELL_MUTED_CLASS}>
                  {ageDisplay === 'time'
                    ? formatTradeClockTime(row.submitted_at)
                    : formatRelativeShort(row.submitted_at)}
                </span>
              </td>
              <td className={DESK_CELL_CLASS}>
                <span
                  className={cn(
                    sizeClass,
                    'uppercase tracking-wide',
                    tone === 'buy' ? 'text-signal-bull' : 'text-signal-bear',
                  )}
                >
                  {row.side === 'buy' ? 'Buy' : 'Sell'}
                </span>
              </td>
              <td className={cn(DESK_CELL_CLASS, 'text-right')}>
                <span className="text-[12px] font-medium font-sans tabular-nums text-fg-primary">
                  {tradeFillMcUsdLabel(row)}
                </span>
              </td>
              <td className={cn(DESK_CELL_CLASS, 'text-right')}>
                <span className="text-[11px] font-normal font-mono tabular-nums text-fg-primary">
                  {formatCompactNumber(tokens)}
                </span>
              </td>
              <td className="relative h-7 w-[140px] max-w-[140px] overflow-hidden bg-bg-hover/35 p-0 align-middle [contain:paint] pointer-events-none">
                <InlineBarCell
                  className="h-full w-full"
                  value={totalBarValue}
                  max={totalBarMax}
                  tone={tone}
                >
                  {displayMode === 'SOL' ? (
                    <>
                      <ChainIcon chain="sol" size={12} />
                      {solDisplay}
                    </>
                  ) : (
                    formatCompactUsd(usdValue)
                  )}
                </InlineBarCell>
              </td>
              <td className={cn(DESK_CELL_CLASS, 'min-w-[200px] text-right')}>
                <div className="flex items-center justify-end gap-1.5">
                  {wallet && deskExtras ? (
                    <>
                      <WalletIdentityAnchor
                        address={wallet}
                        mint={mint}
                        tokenSymbol={tokenSymbol}
                        creatorWallet={creatorWallet}
                        href={`/wallet/${encodeURIComponent(wallet)}`}
                        preferIntelModal
                        truncate={4}
                        addressFormat="axiom"
                        badgeBeforeAddress
                        suppressFilterButton
                        addressNoTruncate
                        maxBadges={2}
                        isDev={deskExtras.isDev}
                        isSniper={deskExtras.isSniper}
                        inlineBadges={deskExtras.inlineBadges}
                        showInlineBadges={true}
                        onFilterMintTrades={onFilterMintTrades}
                        tradesFilterActive={tradesMakerFilter === wallet}
                        className="cursor-pointer font-mono text-[11px] text-fg-secondary hover:text-fg-primary"
                      />
                      {traderHint.tradeCountForMint != null ? (
                        <span
                          className="shrink-0 rounded bg-bg-sunken/80 px-1 py-px text-[10px] font-mono tabular-nums text-fg-muted"
                          title="TX count"
                        >
                          {traderHint.tradeCountForMint}
                        </span>
                      ) : null}
                      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <TooltipProvider delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <a
                                href={explorerAddressUrl(wallet)}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex h-5 w-5 items-center justify-center rounded-sm text-fg-muted hover:bg-bg-hover hover:text-fg-primary"
                                aria-label="Open in explorer"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <ExternalLink className="h-3 w-3" strokeWidth={2} />
                              </a>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-[10px]">
                              Open TX in Solscan
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        {onFilterMintTrades ? (
                          <WalletMintTradesFilterButton
                            icon="filter"
                            active={tradesMakerFilter === wallet}
                            onClick={() => onFilterMintTrades(wallet)}
                          />
                        ) : null}
                      </div>
                    </>
                  ) : (
                    <span className={cn('truncate', CELL_WALLET_CLASS)}>
                      {traderHint.shortLabel}
                    </span>
                  )}
                </div>
              </td>
              <td className="w-8 p-0" aria-hidden />
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
