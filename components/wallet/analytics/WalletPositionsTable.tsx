'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
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
  const router = useRouter();

  const pctRemaining = (row: WalletPositionRow) => {
    const b = row.boughtUsd ?? 0;
    const r = row.remainingUsd ?? 0;
    if (b <= 0) return 0;
    return Math.min(100, Math.max(0, (r / b) * 100));
  };

  return (
    <div className="overflow-x-auto rounded-b-lg border border-t-0 border-white/[0.07] bg-[#070a0f]/50">
      <table className="w-full min-w-[860px] border-collapse text-left text-[11px]">
        <thead>
          <tr className="border-b border-white/[0.065] bg-white/[0.02] text-[8.5px] uppercase tracking-[0.09em] text-fg-muted/90">
            <th className="px-3 py-2 font-semibold">Token</th>
            <th className="px-3 py-2 text-right font-semibold">Remaining</th>
            <th className="px-3 py-2 text-right font-semibold">R. PNL</th>
            <th className="px-3 py-2 text-right font-semibold">Buys</th>
            <th className="px-3 py-2 text-right font-semibold">Sells</th>
            <th className="px-3 py-2 text-right font-semibold">Activity</th>
            <th className="w-12 px-2 py-2 text-right font-semibold">Share</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-10 text-center text-fg-muted">
                No token positions loaded for this wallet on {timeframe}.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={row.mint}
                role="link"
                tabIndex={0}
                onClick={() => {
                  router.push(`/token/${encodeURIComponent(row.mint)}`);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    router.push(`/token/${encodeURIComponent(row.mint)}`);
                  }
                }}
                className="group cursor-pointer border-b border-white/[0.035] transition-colors last:border-b-0 hover:bg-white/[0.04]"
              >
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full bg-white/[0.06] ring-1 ring-white/[0.08]">
                      {row.imageUrl ? (
                        <Image src={row.imageUrl} alt="" fill className="object-cover" sizes="28px" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-[9px] font-bold text-fg-muted">
                          {row.symbol.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-semibold leading-tight text-fg-primary">{row.symbol}</p>
                      <p className="truncate text-[9.5px] text-fg-muted">{row.name ?? row.mint}</p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2 text-right align-top tabular-nums text-fg-secondary">
                  <div className="flex flex-col items-end gap-1">
                    <span className="font-semibold text-fg-primary/95">
                      {row.remainingUsd != null ? formatCompactUsd(row.remainingUsd) : '—'}
                    </span>
                    <div className="h-1 w-[4.25rem] overflow-hidden rounded-full bg-white/[0.06]">
                      <div
                        className="h-full rounded-full bg-accent-primary/55"
                        style={{ width: `${pctRemaining(row).toFixed(0)}%` }}
                      />
                    </div>
                    <span className="text-[9px] text-fg-muted">{pctRemaining(row).toFixed(0)}%</span>
                  </div>
                </td>
                <td
                  className={cn(
                    'px-3 py-2 text-right align-top tabular-nums text-[12px] font-semibold',
                    row.pnlUsd != null && row.pnlUsd >= 0 && 'text-emerald-300/90',
                    row.pnlUsd != null && row.pnlUsd < 0 && 'text-rose-300/90',
                    row.pnlUsd == null && 'text-fg-muted',
                  )}
                >
                  {row.pnlUsd != null ? formatCompactUsd(row.pnlUsd) : '—'}
                </td>
                <td className="px-3 py-2 text-right align-top">
                  <ColUsdTxn usd={row.boughtUsd} txns={row.boughtTxnCount} tone="bull" />
                </td>
                <td className="px-3 py-2 text-right align-top">
                  <ColUsdTxn usd={row.soldUsd} txns={row.soldTxnCount} tone="bear" />
                </td>
                <td className="px-3 py-2 text-right align-top tabular-nums text-[11px] text-fg-secondary">
                  {row.lastActivityLabel ?? '—'}
                </td>
                <td className="px-2 py-2 text-right align-middle">
                  <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                    <SharePnlRowButton
                      onClick={() => onShareRow(row)}
                      className="h-7 w-7 rounded-md opacity-50 group-hover:opacity-100"
                    />
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

function ColUsdTxn({ usd, txns, tone = 'bull' }: { usd: number | null; txns?: number | null; tone?: 'bull' | 'bear' }) {
  return (
    <div className="flex flex-col items-end gap-0.5 leading-tight">
      <span
        className={cn(
          'font-semibold',
          tone === 'bull' ? 'text-emerald-300/85' : 'text-rose-300/85',
        )}
      >
        {usd != null ? formatCompactUsd(usd) : '—'}
      </span>
      <span className="text-[9.5px] text-fg-muted">
        {txns != null ? `${txns} txn${txns === 1 ? '' : 's'}` : '—'}
      </span>
    </div>
  );
}
