'use client';

import { demoWalletAt } from '@/lib/dev/demoTokenFixtures';
import { cn } from '@/lib/utils/cn';
import { TopTraderWalletCell } from '@/components/tokens/TopTraderWalletCell';
import { StackedNumericCell } from './cells/StackedNumericCell';
import { FundingCell } from './cells/FundingCell';
import { PnlCell } from './cells/PnlCell';
import { SortableTh } from './cells/SortableTh';
import { DeskHeaderSettings } from './cells/DeskHeaderSettings';
import {
  DESK_CELL_CLASS,
  DESK_CELL_FIRST_CLASS,
  DESK_CELL_LAST_CLASS,
  DESK_HEADER_CLASS,
  DESK_HEADER_NUM_CLASS,
  DESK_ROW_CLASS,
  DESK_STICKY_HEAD_CLASS,
  DESK_TABLE_CLASS,
  CELL_MUTED_CLASS,
  CELL_PRIMARY_CLASS,
} from './cells/deskTokens';
import { formatCompactUsd, formatCompactNumber, formatAgeShort, formatDuration } from '@/lib/format';
import type { MintTopTraderRow } from '@/lib/trading/mintTopTraders';

import type { HolderDeskSynthFunding } from '@/lib/tokens/holderDeskSynth';
import { useHoldersTableSettingsStore } from '@/store/holdersTableSettings';

export type EnrichedTopTraderRow = MintTopTraderRow & {
  funding?: HolderDeskSynthFunding | null;
};

type Props = {
  rows: EnrichedTopTraderRow[];
  mint: string;
  tokenSymbol?: string | null;
  creatorWallet?: string | null;
  displayMode: 'USD' | 'SOL';
  nativeSym?: string;
  solPriceUsd?: number;
  onSortPnL?: () => void;
  sortDir?: 'asc' | 'desc' | null;
  onFilterMintTrades?: (address: string) => void;
  tradesMakerFilter?: string | null;
  onOpenSettings?: () => void;
};

export function TopTradersTable({
  rows,
  mint,
  tokenSymbol,
  creatorWallet,
  displayMode,
  nativeSym = 'SOL',
  solPriceUsd = 0,
  onSortPnL,
  sortDir,
  onFilterMintTrades,
  tradesMakerFilter,
  onOpenSettings,
}: Props) {
  const sym = tokenSymbol ?? 'TOK';
  const col = useHoldersTableSettingsStore((s) => s.settings.columns);

  return (
    <table className={cn('w-full table-fixed border-collapse', DESK_TABLE_CLASS)}>
      <colgroup>
        <col className="w-[36px]" />
        <col className="w-[180px]" />
        <col className="w-[130px]" />
        <col className="w-[140px]" />
        <col className="w-[140px]" />
        <col className="w-[100px]" />
        <col className="w-[90px]" />
        <col className="w-[160px]" />
        <col className="w-[80px]" />
        <col className="w-[28px]" />
      </colgroup>

      <thead className={DESK_STICKY_HEAD_CLASS}>
        <tr>
          <th className={cn(DESK_HEADER_CLASS, 'pl-3 text-right text-fg-muted/60')}>#</th>
          <th className={DESK_HEADER_CLASS}>Wallet</th>
          <th className={DESK_HEADER_NUM_CLASS}>
            <div className="flex flex-col items-end gap-0 leading-none">
              <span>{nativeSym} Balance</span>
              {col.lastActive ? (
                <span className="mt-0.5 text-[9px] font-normal normal-case tracking-normal text-fg-muted/60">
                  (Last Active)
                </span>
              ) : null}
            </div>
          </th>
          <th className={DESK_HEADER_NUM_CLASS}>
            <div className="flex flex-col items-end gap-0 leading-none">
              <span>Bought</span>
              {col.averageEntry || col.totalTransactions ? (
                <span className="mt-0.5 text-[9px] font-normal normal-case tracking-normal text-fg-muted/60">
                  {col.averageEntry && col.totalTransactions ? 'Avg · Buy' : col.averageEntry ? 'Avg' : 'Buy'}
                </span>
              ) : null}
            </div>
          </th>
          <th className={DESK_HEADER_NUM_CLASS}>
            <div className="flex flex-col items-end gap-0 leading-none">
              <span>Sold</span>
              {col.averageExit || col.totalTransactions ? (
                <span className="mt-0.5 text-[9px] font-normal normal-case tracking-normal text-fg-muted/60">
                  {col.averageExit && col.totalTransactions ? 'Avg · Sell' : col.averageExit ? 'Avg' : 'Sell'}
                </span>
              ) : null}
            </div>
          </th>
          <SortableTh
            label="R. PnL"
            align="right"
            sortDir={sortDir}
            onSort={onSortPnL}
          />
          <SortableTh
            label={
              <span className="flex flex-col items-end leading-tight">
                <span>Remaining</span>
              </span>
            }
            align="right"
          />
          <th className={DESK_HEADER_CLASS}>Funding</th>
          <SortableTh label="Held" align="right" className="pr-3" />
          <DeskHeaderSettings onOpen={onOpenSettings} />
        </tr>
      </thead>

      <tbody>
        {rows.map((row, i) => {
          const realizedPnl = row.realized_pnl_usd ?? 0;
          const pnlDisplay =
            displayMode === 'SOL' && solPriceUsd > 0
              ? `${realizedPnl >= 0 ? '+' : ''}${(realizedPnl / solPriceUsd).toFixed(2)} ${nativeSym}`
              : `${realizedPnl >= 0 ? '+' : ''}${formatCompactUsd(realizedPnl)}`;

          return (
            <tr key={row.wallet_address} className={DESK_ROW_CLASS}>
              <td className={cn(DESK_CELL_FIRST_CLASS, 'text-right')}>
                <span className={CELL_MUTED_CLASS}>{i + 1}</span>
              </td>
              <td className={DESK_CELL_CLASS}>
                <TopTraderWalletCell
                  wallet={row.wallet_address}
                  sym={sym}
                  topTraderRow={row}
                  rank={i + 1}
                  mint={mint}
                  creatorWallet={creatorWallet}
                  isDev={Boolean(creatorWallet && creatorWallet === row.wallet_address)}
                  isSniper={
                    row.wallet_address === demoWalletAt(3) ||
                    row.wallet_address === demoWalletAt(8)
                  }
                  onFilterMintTrades={onFilterMintTrades}
                  tradesFilterActive={tradesMakerFilter === row.wallet_address}
                />
              </td>
              <td className={cn(DESK_CELL_CLASS, 'text-right')}>
                <StackedNumericCell
                  primary="—"
                  secondary={
                    col.lastActive && row.last_trade_at
                      ? `(${formatAgeShort(row.last_trade_at)})`
                      : null
                  }
                />
              </td>
              <td className={cn(DESK_CELL_CLASS, 'text-right')}>
                <StackedNumericCell
                  primary={formatCompactUsd(row.buy_usd)}
                  secondary={
                    col.totalTransactions
                      ? `${formatCompactNumber(row.buy_token_qty)} / ${row.buy_count}`
                      : null
                  }
                  tertiary={
                    col.averageEntry && row.avg_buy_usd_per_token != null
                      ? `(${formatCompactUsd(row.avg_buy_usd_per_token)})`
                      : null
                  }
                  tone={row.buy_usd > 0 ? 'buy' : 'neutral'}
                />
              </td>
              <td className={cn(DESK_CELL_CLASS, 'text-right')}>
                <StackedNumericCell
                  primary={formatCompactUsd(row.sell_usd)}
                  secondary={
                    col.totalTransactions
                      ? `${formatCompactNumber(row.sell_token_qty)} / ${row.sell_count}`
                      : null
                  }
                  tertiary={
                    col.averageExit && row.avg_sell_usd_per_token != null
                      ? `(${formatCompactUsd(row.avg_sell_usd_per_token)})`
                      : null
                  }
                  tone={row.sell_usd > 0 ? 'sell' : 'neutral'}
                />
              </td>
              <td className={cn(DESK_CELL_CLASS, 'text-right align-middle')}>
                <PnlCell value={realizedPnl} display={pnlDisplay} size="hero" />
              </td>
              <td className={cn(DESK_CELL_CLASS, 'text-right')}>
                <div className="flex flex-col items-end gap-[1px]">
                  <span className={CELL_PRIMARY_CLASS}>$0</span>
                  <span className={CELL_MUTED_CLASS}>0%</span>
                </div>
              </td>
              <td className={DESK_CELL_CLASS}>
                <FundingCell
                  venue={row.funding?.venue ?? null}
                  ageSinceFund={row.funding?.ageSinceFund ?? null}
                  solFunding={row.funding?.solFunding ?? null}
                  txCount={col.fundingCount ? row.funding?.txCount ?? null : null}
                  sharedFundedCount={
                    col.sharedWalletFunding ? row.funding?.sharedFundedCount ?? null : null
                  }
                />
              </td>
              <td className={cn(DESK_CELL_LAST_CLASS, 'text-right')}>
                <span
                  className={cn(
                    CELL_MUTED_CLASS,
                    col.timeLinkedFunding && 'text-signal-info',
                  )}
                >
                  {row.held_seconds != null ? formatDuration(row.held_seconds) : '\u2014'}
                </span>
              </td>
              <td className="w-8 p-0" aria-hidden />
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
