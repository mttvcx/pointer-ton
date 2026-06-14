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
  tradeIsLiquidityEvent,
  tradeMcColumnLabel,
  tradePriceAtFillLabel,
  tradeTraderHint,
  tradeWalletDeskExtras,
  tradeRowDemoIndex,
  walletsMatch,
} from '@/lib/tokens/tradeFormatting';
import {
  deskRowClass,
  DESK_STICKY_HEAD_CLASS,
  DESK_TABLE_CLASS,
  CELL_MUTED_CLASS,
  CELL_WALLET_CLASS,
  TRADES_DESK_GRID_COLS,
  TRADES_DESK_HEADER_CELL,
  TRADES_DESK_BODY_CELL,
} from './cells/deskTokens';
import { InlineBarCell } from './cells/InlineBarCell';
import { SortIndicator } from './cells/SortableTh';
import { TradeDeskYouLabel } from '@/components/tokens/cells/TradeDeskYouLabel';
import { WalletIdentityAnchor } from '@/components/wallet/identity/WalletIdentityAnchor';
import { WalletMintTradesFilterButton } from './cells/WalletMintTradesFilterButton';
import { ChainIcon } from '@/components/squads/ChainIcon';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { explorerAddressUrl } from '@/lib/utils/addresses';
import { TerminalNativeBalance } from '@/lib/utils/terminalBalanceFormat';
import type { Tables } from '@/lib/supabase/types';

type TradeRow = Tables<'trades'>;

const TRADES_GRID_STYLE = { gridTemplateColumns: TRADES_DESK_GRID_COLS } as const;

type Props = {
  rows: TradeRow[];
  mint: string;
  tokenSymbol?: string | null;
  creatorWallet?: string | null;
  supplyTokens?: number | null;
  marketCapUsd?: number | null;
  totalDisplayMode: 'USD' | 'SOL';
  mcDisplay: 'mc' | 'price';
  nativeSym?: string;
  onFilterMintTrades?: (address: string) => void;
  tradesMakerFilter?: string | null;
  onToggleTotalDisplayMode?: () => void;
  onToggleMcDisplay?: () => void;
  ageSortDir: 'asc' | 'desc';
  onAgeSortDirChange: (dir: 'asc' | 'desc') => void;
  ageDisplay: 'age' | 'time';
  onAgeDisplayChange: (mode: 'age' | 'time') => void;
  viewerWallet?: string | null;
};

function HeaderToggle({
  label,
  onClick,
  title,
}: {
  label: string;
  onClick?: () => void;
  title: string;
}) {
  if (!onClick) {
    return <span>{label}</span>;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="inline-flex items-center gap-1 rounded-sm transition-colors hover:text-fg-primary"
    >
      <span>{label}</span>
      <ArrowLeftRight className="h-2.5 w-2.5 shrink-0 text-fg-muted/45" strokeWidth={2} aria-hidden />
    </button>
  );
}

export function MintTradesTable({
  rows,
  mint,
  tokenSymbol,
  creatorWallet = null,
  supplyTokens = null,
  marketCapUsd = null,
  totalDisplayMode,
  mcDisplay,
  nativeSym = 'SOL',
  onFilterMintTrades,
  tradesMakerFilter,
  onToggleTotalDisplayMode,
  onToggleMcDisplay,
  ageSortDir,
  onAgeSortDirChange,
  ageDisplay,
  onAgeDisplayChange,
  viewerWallet = null,
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
    <div className={cn('w-full min-w-0', DESK_TABLE_CLASS)} role="table" aria-label="Token trades">
      <div
        className={cn('grid w-full', DESK_STICKY_HEAD_CLASS)}
        style={TRADES_GRID_STYLE}
        role="rowgroup"
      >
        <div className={cn(TRADES_DESK_HEADER_CELL, 'whitespace-nowrap')} role="columnheader">
          <span className="inline-flex items-center gap-0.5 normal-case tracking-normal">
            <button
              type="button"
              onClick={() => onAgeDisplayChange('age')}
              className={cn(
                'rounded-sm px-0.5 transition-colors',
                ageDisplay === 'age' ? 'text-fg-primary' : 'text-fg-muted/60 hover:text-fg-secondary',
              )}
            >
              Age
            </button>
            {ageDisplay === 'age' ? (
              <button
                type="button"
                onClick={() => onAgeSortDirChange(ageSortDir === 'desc' ? 'asc' : 'desc')}
                className="inline-flex items-center rounded-sm px-0.5 text-fg-muted/70 transition-colors hover:text-fg-primary"
                aria-label={`Sort trades by time, ${ageSortDir === 'desc' ? 'newest first' : 'oldest first'}`}
                title={`Sort ${ageSortDir === 'desc' ? 'newest first' : 'oldest first'}`}
              >
                <SortIndicator sortDir={ageSortDir} />
              </button>
            ) : null}
            <span className="text-fg-muted/35">/</span>
            <button
              type="button"
              onClick={() => onAgeDisplayChange('time')}
              className={cn(
                'rounded-sm px-0.5 transition-colors',
                ageDisplay === 'time' ? 'text-fg-primary' : 'text-fg-muted/60 hover:text-fg-secondary',
              )}
            >
              Time
            </button>
            {ageDisplay === 'time' ? (
              <button
                type="button"
                onClick={() => onAgeSortDirChange(ageSortDir === 'desc' ? 'asc' : 'desc')}
                className="inline-flex items-center rounded-sm px-0.5 text-fg-muted/70 transition-colors hover:text-fg-primary"
                aria-label={`Sort trades by time, ${ageSortDir === 'desc' ? 'newest first' : 'oldest first'}`}
              >
                <SortIndicator sortDir={ageSortDir} />
              </button>
            ) : null}
          </span>
        </div>
        <div className={TRADES_DESK_HEADER_CELL} role="columnheader">
          Type
        </div>
        <div className={TRADES_DESK_HEADER_CELL} role="columnheader">
          <HeaderToggle
            label={mcDisplay === 'mc' ? 'MC' : 'Price'}
            onClick={onToggleMcDisplay}
            title={mcDisplay === 'mc' ? 'Show price at fill' : 'Show market cap'}
          />
        </div>
        <div className={TRADES_DESK_HEADER_CELL} role="columnheader">
          Amount
        </div>
        <div className={TRADES_DESK_HEADER_CELL} role="columnheader">
          <HeaderToggle
            label={totalDisplayMode === 'SOL' ? `Total ${nativeSym}` : 'Total USD'}
            onClick={onToggleTotalDisplayMode}
            title={totalDisplayMode === 'SOL' ? 'Show USD notional' : `Show ${nativeSym} notional`}
          />
        </div>
        <div className={cn(TRADES_DESK_HEADER_CELL, 'justify-end')} role="columnheader">
          Trader
        </div>
      </div>

      <div role="rowgroup">
        {sortedRows.map((row, i) => {
          const liqEvent = tradeIsLiquidityEvent(row);
          const tone = liqEvent ? 'sell' : row.side === 'buy' ? 'buy' : 'sell';
          const sol = row.amount_sol ?? 0;
          const tokens = row.amount_token ?? 0;
          const traderHint = tradeTraderHint(row, i);
          const usdValue = Math.abs(sol * (row.price_usd_at_fill ?? 0));
          const totalBarValue = totalDisplayMode === 'SOL' ? Math.abs(sol) : usdValue;
          const totalBarMax = totalDisplayMode === 'SOL' ? maxSol : maxUsd;

          const wallet = traderHint.fullAddress;
          const demoIdx = tradeRowDemoIndex(row);
          const chainBadges = (row as TradeRow & { desk_badges?: string[] }).desk_badges;
          const deskExtras = wallet
            ? tradeWalletDeskExtras(wallet, demoIdx, creatorWallet, chainBadges as never)
            : null;

          const sideLabel = liqEvent ? 'Remove' : row.side === 'buy' ? 'Buy' : 'Sell';

          return (
            <div
              key={row.id}
              className={cn('grid w-full', deskRowClass(i, liqEvent ? '!bg-signal-bear/10' : undefined))}
              style={TRADES_GRID_STYLE}
              role="row"
            >
              <div className={TRADES_DESK_BODY_CELL} role="cell">
                <span className={CELL_MUTED_CLASS}>
                  {ageDisplay === 'time'
                    ? formatTradeClockTime(row.submitted_at)
                    : formatRelativeShort(row.submitted_at)}
                </span>
              </div>
              <div className={TRADES_DESK_BODY_CELL} role="cell">
                <span
                  className={cn(
                    'text-[11px] font-medium capitalize',
                    liqEvent ? 'text-signal-bear' : tone === 'buy' ? 'text-signal-bull' : 'text-signal-bear',
                  )}
                >
                  {sideLabel}
                </span>
              </div>
              <div className={TRADES_DESK_BODY_CELL} role="cell">
                <span
                  className={cn(
                    'text-[12px] font-normal font-sans tabular-nums',
                    liqEvent ? 'font-medium uppercase text-fg-primary' : 'text-fg-primary',
                  )}
                >
                  {mcDisplay === 'price'
                    ? tradePriceAtFillLabel(row)
                    : tradeMcColumnLabel(row, supplyTokens, marketCapUsd)}
                </span>
              </div>
              <div className={TRADES_DESK_BODY_CELL} role="cell">
                <span className="text-[11px] font-normal font-sans tabular-nums text-fg-primary">
                  {formatCompactNumber(tokens)}
                </span>
              </div>
              <div className={cn(TRADES_DESK_BODY_CELL, 'relative min-w-0 overflow-hidden pr-2')} role="cell">
                <InlineBarCell
                  className="h-full w-full min-h-0"
                  value={totalBarValue}
                  max={totalBarMax}
                  tone={tone}
                >
                  {totalDisplayMode === 'SOL' ? (
                    <>
                      <ChainIcon chain="sol" size={12} />
                      <TerminalNativeBalance amount={sol} />
                    </>
                  ) : (
                    formatCompactUsd(usdValue)
                  )}
                </InlineBarCell>
              </div>
              <div className={cn(TRADES_DESK_BODY_CELL, 'justify-end pl-1 pr-3')} role="cell">
                {wallet && deskExtras ? (
                  walletsMatch(wallet, viewerWallet) ? (
                    <TradeDeskYouLabel />
                  ) : (
                    <div className="flex min-w-0 max-w-full items-center justify-end gap-1.5">
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
                      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
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
                        {onFilterMintTrades ? (
                          <WalletMintTradesFilterButton
                            icon="filter"
                            active={tradesMakerFilter === wallet}
                            onClick={() => onFilterMintTrades(wallet)}
                          />
                        ) : null}
                      </div>
                    </div>
                  )
                ) : (
                  <span className={cn('truncate', CELL_WALLET_CLASS)}>{traderHint.shortLabel}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
