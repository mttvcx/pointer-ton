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
  deskRowClass,
  DESK_STICKY_HEAD_CLASS,
  DESK_TABLE_CLASS,
  CELL_MUTED_CLASS,
  CELL_PRIMARY_CLASS,
} from './cells/deskTokens';
import type { HolderDeskSynth } from '@/lib/tokens/holderDeskSynth';
import { isKnownCexVenue } from '@/components/tokens/cells/VenueIcon';
import { useHoldersTableSettingsStore } from '@/store/holdersTableSettings';
import { DeskMissingValue } from '@/components/tokens/cells/DeskMissingValue';
import { DESK_FIELD_TOOLTIPS } from '@/lib/tokens/deskFieldTooltips';

import type { WalletIntelBadgeKind } from '@/lib/walletIdentity/types';

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

import type { HolderDeskSynthFunding } from '@/lib/tokens/holderDeskSynth';

export type HolderDeskMeta = {
  displayLabel: string | null;
  role?: 'lp' | 'bonding_curve' | 'locked_vault' | null;
  inlineBadges: WalletIntelBadgeKind[];
  isSystemAccount: boolean;
  isDev: boolean;
  isSniper: boolean;
  isFresh: boolean;
  funding: HolderDeskSynthFunding | null;
  lockedVaultTooltip?: string | null;
};

type EnrichedHolderRow = HolderDeskRow & {
  synth: HolderDeskSynth;
  deskMeta?: HolderDeskMeta;
};

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
  onOpenSettings?: () => void;
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
  onOpenSettings,
}: Props) {
  const col = useHoldersTableSettingsStore((s) => s.settings.columns);

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
              {col.lastActive ? (
                <span className="text-[9.5px] font-normal normal-case tracking-normal text-fg-muted/60">
                  (Last active)
                </span>
              ) : null}
            </div>
          </th>
          <th className={DESK_HEADER_NUM_CLASS}>
            <div className="flex flex-col items-end leading-tight">
              <span>Bought</span>
              {col.averageEntry || col.totalTransactions ? (
                <span className="text-[9.5px] font-normal normal-case tracking-normal text-fg-muted/60">
                  {col.averageEntry && col.totalTransactions
                    ? 'Avg · qty · n'
                    : col.averageEntry
                      ? 'Avg'
                      : 'qty · n'}
                </span>
              ) : null}
            </div>
          </th>
          <th className={DESK_HEADER_NUM_CLASS}>
            <div className="flex flex-col items-end leading-tight">
              <span>Sold</span>
              {col.averageExit || col.totalTransactions ? (
                <span className="text-[9.5px] font-normal normal-case tracking-normal text-fg-muted/60">
                  {col.averageExit && col.totalTransactions
                    ? 'Avg · qty · n'
                    : col.averageExit
                      ? 'Avg'
                      : 'qty · n'}
                </span>
              ) : null}
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
          <DeskHeaderSettings onOpen={onOpenSettings} />
        </tr>
      </thead>

      <tbody>
        {rows.map((row, i) => {
          const synth = row.synth;
          const meta = row.deskMeta;
          const systemAccount = meta?.isSystemAccount ?? false;
          const indexedDesk = !systemAccount && synth.boughtUsd !== '\u2014';
          const pctRemain = row.pct_of_supply ?? synth.pctLine;
          const dash = '\u2014';
          const lpLabel = meta?.role === 'lp' ? 'LIQUIDITY POOL' : meta?.displayLabel ?? null;
          const systemRole =
            meta?.role === 'lp' ? ('lp' as const) : meta?.role === 'locked_vault' ? ('locked_vault' as const) : null;

          return (
            <tr key={row.wallet_address} className={deskRowClass(i)}>
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
                  isDev={meta?.isDev ?? !!row.is_dev}
                  isSniper={meta?.isSniper ?? !!row.is_sniper}
                  inlineBadges={meta?.inlineBadges}
                  forcedLabel={lpLabel}
                  deskSystemRole={systemRole}
                  lockedVaultTooltip={meta?.lockedVaultTooltip}
                  addressFormat="axiom"
                  badgeBeforeAddress
                  showInlineBadges
                  truncate={6}
                  onFilterMintTrades={onFilterMintTrades}
                  tradesFilterActive={tradesMakerFilter === row.wallet_address}
                  className={cn(
                    'text-[12px] font-normal hover:text-accent-primary',
                    meta?.role === 'lp' ? 'font-semibold text-signal-info' : 'text-fg-secondary',
                  )}
                />
              </td>
              <td className={cn(DESK_CELL_CLASS, 'text-right')}>
                {systemAccount || !indexedDesk || synth.solBalance <= 0 ? (
                  <DeskMissingValue
                    tooltip={
                      systemAccount
                        ? meta?.role === 'lp'
                          ? DESK_FIELD_TOOLTIPS.lpPool
                          : DESK_FIELD_TOOLTIPS.lockedVault
                        : DESK_FIELD_TOOLTIPS.solBalance
                    }
                  />
                ) : (
                  <StackedNumericCell
                    primary={`${synth.solBalance} ${nativeSym}`}
                    secondary={
                      col.lastActive && synth.lastActive && synth.lastActive !== dash
                        ? `(${synth.lastActive})`
                        : null
                    }
                  />
                )}
              </td>
              <td className={cn(DESK_CELL_CLASS, 'text-right')}>
                {!indexedDesk ? (
                  <DeskMissingValue tooltip={DESK_FIELD_TOOLTIPS.bought} />
                ) : (
                  <StackedNumericCell
                    primary={synth.boughtUsd}
                    secondary={
                      col.totalTransactions &&
                      synth.boughtTokensCompact &&
                      synth.buyTxCount != null
                        ? `${synth.boughtTokensCompact} / ${synth.buyTxCount}`
                        : null
                    }
                    tertiary={col.averageEntry && synth.avgBuyUsd ? `(${synth.avgBuyUsd})` : null}
                    tone={synth.boughtUsd === '$0' ? 'neutral' : 'buy'}
                  />
                )}
              </td>
              <td className={cn(DESK_CELL_CLASS, 'text-right')}>
                {!indexedDesk ? (
                  <DeskMissingValue tooltip={DESK_FIELD_TOOLTIPS.sold} />
                ) : (
                  <StackedNumericCell
                    primary={synth.soldUsd}
                    secondary={
                      !col.totalTransactions
                        ? null
                        : synth.soldUsd === '$0'
                          ? '0 / 0'
                          : synth.soldTokensCompact && synth.sellTxCount != null
                            ? `${synth.soldTokensCompact} / ${synth.sellTxCount}`
                            : null
                    }
                    tertiary={col.averageExit && synth.avgSellUsd ? `(${synth.avgSellUsd})` : null}
                    tone={synth.soldUsd === '$0' ? 'neutral' : 'sell'}
                  />
                )}
              </td>
              <td className={cn(DESK_CELL_CLASS, 'text-right align-middle')}>
                {indexedDesk ? (
                  <PnlCell value={synth.uPnlUsdRaw} display={synth.uPnlUsd} size="hero" />
                ) : (
                  <DeskMissingValue tooltip={DESK_FIELD_TOOLTIPS.uPnl} />
                )}
              </td>
              <td className={cn(DESK_CELL_CLASS, 'h-9 overflow-hidden p-0')}>
                {indexedDesk || (systemAccount && pctRemain > 0) ? (
                  <RemainingBarCell
                    usdLabel={indexedDesk ? synth.remainingUsd : dash}
                    pct={pctRemain}
                  />
                ) : (
                  <div className="flex h-full items-center justify-end px-2">
                    <span className={CELL_MUTED_CLASS}>{dash}</span>
                  </div>
                )}
              </td>
              <td className={DESK_CELL_CLASS}>
                {(() => {
                  const fundRow = meta?.funding ?? (indexedDesk ? synth.funding : null);
                  if (!fundRow?.venue) {
                    return <DeskMissingValue tooltip={DESK_FIELD_TOOLTIPS.funding} />;
                  }
                  const cex = isKnownCexVenue(fundRow.venue);
                  return (
                    <FundingCell
                      venue={cex ? fundRow.venue : null}
                      fundingWallet={cex ? null : fundRow.venue}
                      ageSinceFund={fundRow.ageSinceFund}
                      solFunding={fundRow.solFunding}
                      txCount={col.fundingCount ? fundRow.txCount : null}
                      sharedFundedCount={
                        col.sharedWalletFunding ? fundRow.sharedFundedCount : null
                      }
                    />
                  );
                })()}
              </td>
              <td className={cn(DESK_CELL_LAST_CLASS, 'text-right')}>
                {!indexedDesk || synth.heldAge === dash ? (
                  <DeskMissingValue tooltip={DESK_FIELD_TOOLTIPS.held} />
                ) : (
                  <span
                    className={cn(
                      CELL_MUTED_CLASS,
                      col.timeLinkedFunding && 'text-signal-info',
                    )}
                  >
                    {synth.heldAge}
                  </span>
                )}
              </td>
              <td className="w-8 p-0" aria-hidden />
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
