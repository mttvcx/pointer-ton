'use client';

import Image from 'next/image';
import { SharePnlRowButton } from '@/components/wallet/analytics/SharePnlRowButton';
import { formatCompactUsd } from '@/lib/utils/formatters';
import type { WalletAnalyticsTimeframe } from '@/lib/wallet-analytics/types';
import type { WalletPositionRow } from '@/lib/wallet-analytics/types';
import { cn } from '@/lib/utils/cn';

export function WalletPositionsTable({
  rows,
  timeframe,
  onShareRow,
}: {
  rows: WalletPositionRow[];
  timeframe: WalletAnalyticsTimeframe;
  onShareRow: (row: WalletPositionRow) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border-subtle/80">
      <table className="w-full min-w-[880px] border-collapse text-left text-[11px]">
        <thead>
          <tr className="border-b border-border-subtle/80 bg-black/25 text-[10px] uppercase tracking-wide text-fg-muted">
            <th className="px-3 py-2 font-semibold">Token</th>
            <th className="px-3 py-2 font-semibold">Bought</th>
            <th className="px-3 py-2 font-semibold">Sold</th>
            <th className="px-3 py-2 font-semibold">Remaining</th>
            <th className="px-3 py-2 font-semibold">PNL</th>
            <th className="px-3 py-2 text-right font-semibold">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-10 text-center text-fg-muted">
                No token positions loaded for this wallet on {timeframe}.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={row.mint}
                className="border-b border-border-subtle/40 transition-colors hover:bg-bg-hover/80"
              >
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-md bg-white/[0.06] ring-1 ring-white/[0.06]">
                      {row.imageUrl ? (
                        <Image src={row.imageUrl} alt="" fill className="object-cover" sizes="32px" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-[10px] font-bold text-fg-muted">
                          {row.symbol.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-fg-primary">{row.symbol}</p>
                      <p className="truncate text-[10px] text-fg-muted">{row.name ?? row.mint}</p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5 tabular-nums text-fg-secondary">
                  <UsdToken
                    usd={row.boughtUsd}
                    ui={row.boughtTokenUi}
                    decimals={row.decimals}
                  />
                </td>
                <td className="px-3 py-2.5 tabular-nums text-fg-secondary">
                  <UsdToken usd={row.soldUsd} ui={row.soldTokenUi} decimals={row.decimals} />
                </td>
                <td className="px-3 py-2.5 tabular-nums text-fg-secondary">
                  <UsdToken
                    usd={row.remainingUsd}
                    ui={row.remainingTokenUi}
                    decimals={row.decimals}
                  />
                </td>
                <td
                  className={cn(
                    'px-3 py-2.5 tabular-nums font-semibold',
                    row.pnlUsd != null && row.pnlUsd >= 0 && 'text-signal-bull',
                    row.pnlUsd != null && row.pnlUsd < 0 && 'text-signal-bear',
                    row.pnlUsd == null && 'text-fg-muted',
                  )}
                >
                  {row.pnlUsd != null ? (
                    <>
                      {formatCompactUsd(row.pnlUsd)}
                      {row.pnlPct != null ? (
                        <span className="ml-1 text-[10px] font-medium opacity-90">
                          ({row.pnlPct >= 0 ? '+' : ''}
                          {row.pnlPct.toFixed(2)}%)
                        </span>
                      ) : null}
                    </>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-3 py-2.5 text-right">
                  <div className="flex justify-end">
                    <SharePnlRowButton onClick={() => onShareRow(row)} />
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function UsdToken({
  usd,
  ui,
  decimals,
}: {
  usd: number | null;
  ui: number | null;
  decimals: number;
}) {
  if (usd == null && ui == null) return <span className="text-fg-muted">—</span>;
  const tok =
    ui != null && Number.isFinite(ui)
      ? ui.toLocaleString(undefined, { maximumFractionDigits: Math.min(6, decimals) })
      : '—';
  return (
    <div className="flex flex-col gap-0.5 leading-tight">
      <span>{usd != null ? formatCompactUsd(usd) : '—'}</span>
      <span className="text-[10px] text-fg-muted">{tok}</span>
    </div>
  );
}
