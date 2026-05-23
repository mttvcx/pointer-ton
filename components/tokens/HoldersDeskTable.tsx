'use client';

import { cn } from '@/lib/utils/cn';
import { WalletIdentityAnchor } from '@/components/wallet/identity/WalletIdentityAnchor';
import { StackedNumericCell } from './cells/StackedNumericCell';
import { FundingCell } from './cells/FundingCell';
import { PnlCell } from './cells/PnlCell';
import { RemainingBarCell } from './cells/RemainingBarCell';
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
} from './cells/deskTokens';
import type { HolderDeskSynth } from '@/lib/tokens/holderDeskSynth';

export type HolderDeskRow = {
  id: number;
  mint: string;
  wallet_address: string;
  amount_raw: string;
  pct_of_supply: number | null;
  is_dev: boolean | null;
  is_sniper: boolean | null;
  rank: number | null;
  computed_at: string;
};

type EnrichedHolderRow = HolderDeskRow & { synth: HolderDeskSynth };

type Props = {
  rows: EnrichedHolderRow[];
  mint: string;
  tokenSymbol?: string | null;
  creatorWallet?: string | null;
  nativeSym?: string;
  onSortUPnL?: () => void;
  sortDir?: 'asc' | 'desc' | null;
  onFilterMintTrades?: (address: string) => void;
  tradesMakerFilter?: string | null;
};

export function HoldersDeskTable({
  rows,
  mint,
  tokenSymbol,
  creatorWallet,
  nativeSym = 'SOL',
  onSortUPnL,
  sortDir,
  onFilterMintTrades,
  tradesMakerFilter,
}: Props) {
  return (
    <table className={cn('w-full table-fixed border-collapse', DESK_TABLE_CLASS)}>
      <colgroup>
        <col className="w-[36px]" />
        <col className="w-[180px]" />
        <col className="w-[130px]" />
        <col className="w-[130px]" />
        <col className="w-[130px]" />
        <col className="w-[100px]" />
        <col className="w-[150px]" />
        <col className="w-[140px]" />
        <col className="w-[70px]" />
        <col className="w-[28px]" />
      </colgroup>

      <thead className={DESK_STICKY_HEAD_CLASS}>
        <tr>
          <th className={cn(DESK_HEADER_CLASS, 'pl-3 text-right text-fg-muted/60')}>#</th>
          <th className={DESK_HEADER_CLASS}>Wallet</th>
          <th className={DESK_HEADER_NUM_CLASS}>
            <div className="flex flex-col items-end leading-tight">
              <span>{nativeSym} Balance</span>
              <span className="text-[9.5px] font-normal normal-case tracking-normal text-fg-muted/60">
                (Last active)
              </span>
            </div>
          </th>
          <th className={DESK_HEADER_NUM_CLASS}>
            <div className="flex flex-col items-end leading-tight">
              <span>Bought</span>
              <span className="text-[9.5px] font-normal normal-case tracking-normal text-fg-muted/60">
                Avg · qty · n
              </span>
            </div>
          </th>
          <th className={DESK_HEADER_NUM_CLASS}>
            <div className="flex flex-col items-end leading-tight">
              <span>Sold</span>
              <span className="text-[9.5px] font-normal normal-case tracking-normal text-fg-muted/60">
                Avg · qty · n
              </span>
            </div>
          </th>
          <SortableTh
            label={
              <span className="flex flex-col items-end leading-tight">
                <span>U. PnL</span>
                <span className="text-[9.5px] font-normal normal-case tracking-normal text-fg-muted/60">
                  Spot est.
                </span>
              </span>
            }
            align="right"
            sortDir={sortDir}
            onSort={onSortUPnL}
          />
          <SortableTh
            label={
              <span className="flex flex-col items-end leading-tight">
                <span>Remaining</span>
                <span className="text-[9.5px] font-normal normal-case tracking-normal text-fg-muted/60">
                  Usd · %
                </span>
              </span>
            }
            align="right"
          />
          <th className={DESK_HEADER_CLASS}>Funding</th>
          <SortableTh label="Held" align="right" className="pr-3" />
          <DeskHeaderSettings />
        </tr>
      </thead>

      <tbody>
        {rows.map((row) => {
          const synth = row.synth;
          const pctRemain = row.pct_of_supply ?? synth.pctLine;

          return (
            <tr key={row.id} className={DESK_ROW_CLASS}>
              <td className={cn(DESK_CELL_FIRST_CLASS, 'text-right')}>
                <span className={CELL_MUTED_CLASS}>
                  {row.rank ?? '\u2014'}
                </span>
              </td>
              <td className={DESK_CELL_CLASS}>
                <WalletIdentityAnchor
                  address={row.wallet_address}
                  mint={mint}
                  tokenSymbol={tokenSymbol}
                  creatorWallet={creatorWallet}
                  href={`/wallet/${encodeURIComponent(row.wallet_address)}`}
                  preferIntelModal
                  isDev={!!row.is_dev}
                  isSniper={!!row.is_sniper}
                  showInlineBadges
                  truncate={6}
                  onFilterMintTrades={onFilterMintTrades}
                  tradesFilterActive={tradesMakerFilter === row.wallet_address}
                  className="text-[12px] font-normal text-fg-secondary hover:text-accent-primary"
                />
              </td>
              <td className={cn(DESK_CELL_CLASS, 'text-right')}>
                <StackedNumericCell
                  primary={`${synth.solBalance} ${nativeSym}`}
                  secondary={synth.lastActive ? `(${synth.lastActive})` : null}
                />
              </td>
              <td className={cn(DESK_CELL_CLASS, 'text-right')}>
                <StackedNumericCell
                  primary={synth.boughtUsd}
                  secondary={
                    synth.boughtTokensCompact && synth.buyTxCount != null
                      ? `${synth.boughtTokensCompact} / ${synth.buyTxCount}`
                      : null
                  }
                  tertiary={synth.avgBuyUsd ? `(${synth.avgBuyUsd})` : null}
                  tone={synth.boughtUsd === '$0' ? 'neutral' : 'buy'}
                />
              </td>
              <td className={cn(DESK_CELL_CLASS, 'text-right')}>
                <StackedNumericCell
                  primary={synth.soldUsd}
                  secondary={
                    synth.soldUsd === '$0'
                      ? '0 / 0'
                      : synth.soldTokensCompact && synth.sellTxCount != null
                        ? `${synth.soldTokensCompact} / ${synth.sellTxCount}`
                        : null
                  }
                  tertiary={synth.avgSellUsd ? `(${synth.avgSellUsd})` : null}
                  tone={synth.soldUsd === '$0' ? 'neutral' : 'sell'}
                />
              </td>
              <td className={cn(DESK_CELL_CLASS, 'text-right align-middle')}>
                <PnlCell
                  value={synth.uPnlUsdRaw}
                  display={synth.uPnlUsd}
                  size="hero"
                />
              </td>
              <td className={cn(DESK_CELL_CLASS, 'h-9 overflow-hidden p-0')}>
                <RemainingBarCell usdLabel={synth.remainingUsd} pct={pctRemain} />
              </td>
              <td className={DESK_CELL_CLASS}>
                <FundingCell
                  venue={synth.funding?.venue}
                  ageSinceFund={synth.funding?.ageSinceFund}
                  solFunding={synth.funding?.solFunding}
                  txCount={synth.funding?.txCount}
                  sharedFundedCount={synth.funding?.sharedFundedCount}
                />
              </td>
              <td className={cn(DESK_CELL_LAST_CLASS, 'text-right')}>
                <span className={CELL_MUTED_CLASS}>{synth.heldAge}</span>
              </td>
              <td className="w-8 p-0" aria-hidden />
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
