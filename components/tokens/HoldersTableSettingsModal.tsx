'use client';

import { useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { GlassModal } from '@/components/ui/GlassModal';
import { modalBtnPrimaryClass } from '@/lib/ui/modalChrome';
import { FundingCell } from '@/components/tokens/cells/FundingCell';
import { PnlCell } from '@/components/tokens/cells/PnlCell';
import { RemainingBarCell } from '@/components/tokens/cells/RemainingBarCell';
import { StackedNumericCell } from '@/components/tokens/cells/StackedNumericCell';
import {
  CELL_MUTED_CLASS,
  DESK_CELL_CLASS,
  DESK_CELL_FIRST_CLASS,
  DESK_CELL_LAST_CLASS,
  DESK_HEADER_CLASS,
  DESK_HEADER_NUM_CLASS,
  DESK_ROW_CLASS,
  DESK_TABLE_CLASS,
} from '@/components/tokens/cells/deskTokens';
import {
  cloneHoldersTableSettings,
  DEFAULT_HOLDERS_TABLE_SETTINGS,
  HOLDERS_TABLE_COLUMN_TOGGLES,
  type HoldersTableColumnId,
  type HoldersTableSettings,
} from '@/lib/tokens/holdersTableSettingsModel';
import { cn } from '@/lib/utils/cn';
import { useHoldersTableSettingsStore } from '@/store/holdersTableSettings';

const PREVIEW_ROWS = [
  {
    rank: 1,
    wallet: '7Hx4m2…9kLp',
    solBalance: '42.12 SOL',
    lastActive: '2m',
    bought: '12.54',
    boughtAvg: '1.235',
    sold: '3.2K',
    soldAvg: '500.1',
    pnl: 2590,
    pnlLabel: '+2.59K',
    remainingUsd: '$2.59K',
    remainingPct: 45.88,
    funding: { venue: 'Binance', ageSinceFund: '1y', solFunding: '12.4', txCount: 3 },
    held: '3h 12m',
  },
  {
    rank: 2,
    wallet: '9kLp…7Hx4',
    solBalance: '18.04 SOL',
    lastActive: '5m',
    bought: '8.1K',
    boughtAvg: '0.892',
    sold: '1.1K',
    soldAvg: '210.4',
    pnl: -423,
    pnlLabel: '-4.23$',
    remainingUsd: '$1.84K',
    remainingPct: 22.4,
    funding: { venue: 'Coinbase', ageSinceFund: '7mo', solFunding: '4.2', txCount: 2 },
    held: '1d 4h',
  },
  {
    rank: 3,
    wallet: '3mNq…pW2a',
    solBalance: '6.88 SOL',
    lastActive: '12m',
    bought: '420',
    boughtAvg: '0.044',
    sold: '$0',
    soldAvg: null,
    pnl: 180,
    pnlLabel: '+$180',
    remainingUsd: '$420',
    remainingPct: 8.2,
    funding: { venue: 'OKX', ageSinceFund: '9d', solFunding: '1.8', txCount: 1 },
    held: '6d',
  },
] as const;

function ColorField({
  label,
  value,
  color,
  onValue,
  onColor,
  onReset,
}: {
  label: string;
  value: number;
  color: string;
  onValue: (n: number) => void;
  onColor: (c: string) => void;
  onReset: () => void;
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <span className="w-12 shrink-0 text-[11px] text-fg-muted">{label}</span>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          onValue(Number.isFinite(n) ? n : 0);
        }}
        className="h-8 w-14 rounded-md border border-white/10 bg-white/[0.04] px-2 text-center text-[12px] tabular-nums text-fg-primary outline-none focus:ring-1 focus:ring-accent-primary/40"
      />
      <label className="relative h-7 w-7 shrink-0 cursor-pointer overflow-hidden rounded-md border border-white/10">
        <input
          type="color"
          value={color}
          onChange={(e) => onColor(e.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          aria-label={`${label} color`}
        />
        <span className="block h-full w-full" style={{ backgroundColor: color }} />
      </label>
      <button
        type="button"
        onClick={onReset}
        className="focus-ring inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-fg-muted transition hover:bg-white/[0.06] hover:text-fg-primary"
        aria-label={`Reset ${label}`}
      >
        <RotateCcw className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
    </div>
  );
}

function SettingsPreviewTable({ draft }: { draft: HoldersTableSettings }) {
  const c = draft.columns;

  return (
    <div className="overflow-x-auto overflow-y-hidden rounded-lg border border-white/[0.08] bg-bg-base/60">
      <table className={cn('w-full min-w-[720px] table-fixed border-collapse', DESK_TABLE_CLASS)}>
        <thead>
          <tr className="border-b border-white/[0.06]">
            <th className={cn(DESK_HEADER_CLASS, 'pl-3 text-right text-fg-muted/60')}>#</th>
            <th className={DESK_HEADER_CLASS}>Wallet</th>
            <th className={DESK_HEADER_NUM_CLASS}>
              <div className="flex flex-col items-end leading-tight">
                <span>SOL Balance</span>
                {c.lastActive ? (
                  <span className="text-[9.5px] font-normal normal-case tracking-normal text-fg-muted/60">
                    (Last Active)
                  </span>
                ) : null}
              </div>
            </th>
            <th className={DESK_HEADER_NUM_CLASS}>
              <div className="flex flex-col items-end leading-tight">
                <span>Bought</span>
                {c.averageEntry ? (
                  <span className="text-[9.5px] font-normal normal-case tracking-normal text-fg-muted/60">
                    (Avg)
                  </span>
                ) : null}
              </div>
            </th>
            <th className={DESK_HEADER_NUM_CLASS}>
              <div className="flex flex-col items-end leading-tight">
                <span>Sold</span>
                {c.averageExit ? (
                  <span className="text-[9.5px] font-normal normal-case tracking-normal text-fg-muted/60">
                    (Avg)
                  </span>
                ) : null}
              </div>
            </th>
            <th className={DESK_HEADER_NUM_CLASS}>PnL</th>
            <th className={DESK_HEADER_NUM_CLASS}>Remaining</th>
            <th className={DESK_HEADER_CLASS}>Funding</th>
            <th className={cn(DESK_HEADER_NUM_CLASS, 'pr-3')}>Holding Time</th>
          </tr>
        </thead>
        <tbody>
          {PREVIEW_ROWS.map((row) => (
            <tr key={row.rank} className={cn(DESK_ROW_CLASS, 'last:border-b-0')}>
              <td className={cn(DESK_CELL_FIRST_CLASS, 'text-right')}>
                <span className={CELL_MUTED_CLASS}>{row.rank}</span>
              </td>
              <td className={DESK_CELL_CLASS}>
                <span className="text-[12px] text-fg-secondary">{row.wallet}</span>
                {c.kolLabels ? (
                  <span className="ml-1 rounded bg-accent-primary/15 px-1 text-[9px] text-accent-primary">
                    KOL
                  </span>
                ) : null}
              </td>
              <td className={cn(DESK_CELL_CLASS, 'text-right')}>
                <StackedNumericCell
                  primary={row.solBalance}
                  secondary={c.lastActive ? `(${row.lastActive})` : null}
                />
              </td>
              <td className={cn(DESK_CELL_CLASS, 'text-right')}>
                <StackedNumericCell
                  primary={row.bought}
                  secondary={c.totalTransactions ? '3 tx' : null}
                  tertiary={c.averageEntry ? `(${row.boughtAvg})` : null}
                  tone="buy"
                />
              </td>
              <td className={cn(DESK_CELL_CLASS, 'text-right')}>
                <StackedNumericCell
                  primary={row.sold}
                  secondary={c.totalTransactions ? '2 tx' : null}
                  tertiary={c.averageExit && row.soldAvg ? `(${row.soldAvg})` : null}
                  tone="sell"
                />
              </td>
              <td className={cn(DESK_CELL_CLASS, 'text-right')}>
                <PnlCell value={row.pnl} display={row.pnlLabel} size="hero" />
              </td>
              <td className={cn(DESK_CELL_CLASS, 'h-9 overflow-hidden p-0')}>
                <RemainingBarCell usdLabel={row.remainingUsd} pct={row.remainingPct} />
              </td>
              <td className={DESK_CELL_CLASS}>
                {c.sharedWalletFunding || c.fundingCount ? (
                  <FundingCell
                    venue={row.funding.venue}
                    ageSinceFund={row.funding.ageSinceFund}
                    solFunding={row.funding.solFunding}
                    txCount={c.fundingCount ? row.funding.txCount : null}
                    sharedFundedCount={c.sharedWalletFunding ? 4 : null}
                  />
                ) : (
                  <span className="text-fg-muted">{'\u2014'}</span>
                )}
              </td>
              <td className={cn(DESK_CELL_LAST_CLASS, 'text-right')}>
                <span
                  className={cn(
                    CELL_MUTED_CLASS,
                    c.timeLinkedFunding && 'text-signal-info',
                  )}
                >
                  {row.held}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function HoldersTableSettingsModal({
  open,
  onClose,
  title = 'Holders Table Settings',
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
}) {
  const saved = useHoldersTableSettingsStore((s) => s.settings);
  const setSettings = useHoldersTableSettingsStore((s) => s.setSettings);
  const [draft, setDraft] = useState(() => cloneHoldersTableSettings(saved));

  useEffect(() => {
    if (open) setDraft(cloneHoldersTableSettings(saved));
  }, [open, saved]);

  const toggle = (id: HoldersTableColumnId) => {
    setDraft((d) => ({
      ...d,
      columns: { ...d.columns, [id]: !d.columns[id] },
    }));
  };

  const handleDone = () => {
    setSettings(draft);
    onClose();
  };

  const handleResetAll = () => {
    setDraft(cloneHoldersTableSettings(DEFAULT_HOLDERS_TABLE_SETTINGS));
  };

  return (
    <GlassModal
      open={open}
      onClose={onClose}
      title={title}
      maxWidthClass="max-w-[920px]"
      className="max-h-[min(92vh,880px)]"
      footer={
        <div className="flex w-full items-center gap-2">
          <button
            type="button"
            onClick={handleResetAll}
            className="focus-ring inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 text-fg-muted transition hover:bg-white/[0.06] hover:text-fg-primary"
            aria-label="Reset all settings"
          >
            <RotateCcw className="h-4 w-4" strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={handleDone}
            className={cn(modalBtnPrimaryClass, 'h-10 flex-1')}
          >
            Done
          </button>
        </div>
      }
    >
      <div className="space-y-4 pb-1">
        <SettingsPreviewTable draft={draft} />

        <div className="flex flex-wrap gap-2">
          {HOLDERS_TABLE_COLUMN_TOGGLES.map(({ id, label }) => {
            const active = draft.columns[id];
            return (
              <button
                key={id}
                type="button"
                onClick={() => toggle(id)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-[11px] font-medium transition',
                  active
                    ? 'border-accent-primary/70 bg-accent-primary/10 text-accent-primary'
                    : 'border-white/10 bg-white/[0.03] text-fg-muted hover:border-white/20 hover:text-fg-secondary',
                )}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="-mx-4 border-t border-white/[0.06]" aria-hidden />

        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-fg-muted">
            Shared Wallet Funding
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
            <ColorField
              label="Lower"
              value={draft.sharedFundingLower}
              color={draft.sharedFundingLowerColor}
              onValue={(n) => setDraft((d) => ({ ...d, sharedFundingLower: n }))}
              onColor={(c) => setDraft((d) => ({ ...d, sharedFundingLowerColor: c }))}
              onReset={() =>
                setDraft((d) => ({
                  ...d,
                  sharedFundingLower: DEFAULT_HOLDERS_TABLE_SETTINGS.sharedFundingLower,
                  sharedFundingLowerColor: DEFAULT_HOLDERS_TABLE_SETTINGS.sharedFundingLowerColor,
                }))
              }
            />
            <ColorField
              label="Upper"
              value={draft.sharedFundingUpper}
              color={draft.sharedFundingUpperColor}
              onValue={(n) => setDraft((d) => ({ ...d, sharedFundingUpper: n }))}
              onColor={(c) => setDraft((d) => ({ ...d, sharedFundingUpperColor: c }))}
              onReset={() =>
                setDraft((d) => ({
                  ...d,
                  sharedFundingUpper: DEFAULT_HOLDERS_TABLE_SETTINGS.sharedFundingUpper,
                  sharedFundingUpperColor: DEFAULT_HOLDERS_TABLE_SETTINGS.sharedFundingUpperColor,
                }))
              }
            />
          </div>
        </div>

        <div className="-mx-4 border-t border-white/[0.06]" aria-hidden />

        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-fg-muted">
            Time-linked Funding
          </p>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-fg-muted">Threshold</span>
            <input
              type="number"
              min={0}
              value={draft.timeLinkedThreshold}
              onChange={(e) => {
                const n = Number(e.target.value);
                setDraft((d) => ({
                  ...d,
                  timeLinkedThreshold: Number.isFinite(n) ? n : 0,
                }));
              }}
              className="h-8 w-16 rounded-md border border-white/10 bg-white/[0.04] px-2 text-center text-[12px] tabular-nums text-fg-primary outline-none focus:ring-1 focus:ring-accent-primary/40"
            />
            <select
              value={draft.timeLinkedUnit}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  timeLinkedUnit: e.target.value as HoldersTableSettings['timeLinkedUnit'],
                }))
              }
              className="h-8 rounded-md border border-white/10 bg-white/[0.04] px-2 text-[12px] text-fg-primary outline-none focus:ring-1 focus:ring-accent-primary/40"
            >
              <option value="m">m</option>
              <option value="h">h</option>
              <option value="d">d</option>
            </select>
          </div>
        </div>
      </div>
    </GlassModal>
  );
}
