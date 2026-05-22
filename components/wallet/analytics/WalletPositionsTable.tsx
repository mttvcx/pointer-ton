'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { SharePnlRowButton } from '@/components/wallet/analytics/SharePnlRowButton';
import { formatCompactUsd, formatNumber } from '@/lib/utils/formatters';
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

  const buySellBar = (row: WalletPositionRow) => {
    const b = row.boughtUsd ?? 0;
    const s = row.soldUsd ?? 0;
    const t = b + s;
    if (t <= 0) return null;
    const buyPct = (b / t) * 100;
    return (
      <div className="mt-1 inline-flex h-1 w-full max-w-[8.5rem] overflow-hidden rounded-full">
        <div className="h-full shrink-0 bg-signal-bull" style={{ width: `${buyPct}%` }} />
        <div className="h-full min-w-0 flex-1 bg-signal-bear" />
      </div>
    );
  };

  return (
    <div className="overflow-x-auto rounded-b-lg border border-t-0 border-border-subtle bg-bg-raised">
      <table className="w-full min-w-[860px] border-collapse text-left text-xs">
        <thead className="bg-bg-sunken text-[10px] font-medium uppercase tracking-wider text-fg-muted">
          <tr className="border-b border-border-subtle">
            <th className="px-3 py-2 text-left font-medium">Token</th>
            <th className="px-3 py-2 text-right font-medium">Remaining</th>
            <th className="px-3 py-2 text-right font-medium">R. PNL</th>
            <th className="px-3 py-2 text-right font-medium">Buys</th>
            <th className="px-3 py-2 text-right font-medium">Sells</th>
            <th className="px-3 py-2 text-right font-medium">Activity</th>
            <th className="w-12 px-2 py-2 text-right font-medium">Share</th>
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
                className="group h-11 cursor-pointer border-b border-border-subtle outline-none transition-colors duration-100 last:border-b-0 hover:bg-bg-hover focus-tr-accent"
              >
                <td className="px-3 align-middle">
                  <div className="flex items-center gap-2">
                    <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-lg border border-border-subtle bg-bg-sunken">
                      {row.imageUrl ? (
                        <Image src={row.imageUrl} alt="" fill className="object-cover" sizes="32px" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-xs font-bold text-fg-secondary">
                          {row.symbol.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-fg-primary">{row.symbol}</p>
                      <p className="truncate text-xs text-fg-muted">{row.name ?? row.mint}</p>
                      {buySellBar(row)}
                    </div>
                  </div>
                </td>
                <td className="px-3 align-middle text-right tabular-nums">
                  <div className="flex flex-col items-end gap-1">
                    <span className="font-mono text-xs text-fg-primary">
                      {row.remainingUsd != null ? formatCompactUsd(row.remainingUsd) : '—'}
                    </span>
                    <div className="mt-0.5 h-0.5 w-[4.25rem] max-w-full overflow-hidden rounded-full bg-accent-primary/40">
                      <div
                        className="h-full rounded-full bg-accent-primary"
                        style={{ width: `${pctRemaining(row).toFixed(0)}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-fg-muted">{pctRemaining(row).toFixed(0)}%</span>
                  </div>
                </td>
                <td className="px-3 align-middle text-right tabular-nums">
                  <div className="flex flex-col items-end gap-px">
                    <span
                      className={cn(
                        'font-mono text-xs font-semibold tabular-nums',
                        row.pnlUsd != null && row.pnlUsd > 0 && 'text-signal-bull',
                        row.pnlUsd != null && row.pnlUsd < 0 && 'text-signal-bear',
                        row.pnlUsd == null && 'text-fg-muted',
                      )}
                    >
                      {row.pnlUsd != null ? formatCompactUsd(row.pnlUsd) : '—'}
                    </span>
                    {row.pnlPct != null && row.pnlUsd != null && row.pnlUsd !== 0 ? (
                      <span
                        className={cn(
                          'font-mono text-[10px] font-semibold tabular-nums',
                          row.pnlUsd > 0 && 'text-signal-bull',
                          row.pnlUsd < 0 && 'text-signal-bear',
                        )}
                      >
                        ({row.pnlPct > 0 ? '+' : ''}
                        {row.pnlPct.toFixed(1)}%)
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="px-3 align-middle text-right">
                  <ColUsdTxn usd={row.boughtUsd} txns={row.boughtTxnCount} tokenQty={row.boughtTokenUi} tone="bull" />
                </td>
                <td className="px-3 align-middle text-right">
                  <ColUsdTxn usd={row.soldUsd} txns={row.soldTxnCount} tokenQty={row.soldTokenUi} tone="bear" />
                </td>
                <td className="px-3 align-middle text-right tabular-nums text-xs text-fg-muted">
                  {row.lastActivityLabel ?? '—'}
                </td>
                <td className="px-2 align-middle text-right">
                  <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                    <SharePnlRowButton
                      onClick={() => onShareRow(row)}
                      className="h-7 w-7 rounded-md border-0 bg-transparent opacity-55 transition hover:bg-bg-hover hover:opacity-100"
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

function ColUsdTxn({
  usd,
  txns,
  tokenQty,
  tone,
}: {
  usd: number | null;
  txns?: number | null;
  tokenQty?: number | null;
  tone: 'bull' | 'bear';
}) {
  const qtyLine =
    tokenQty != null && Number.isFinite(tokenQty)
      ? `${formatNumber(tokenQty, { compact: true })} tok`
      : txns != null
        ? `${txns} txn${txns === 1 ? '' : 's'}`
        : '—';

  return (
    <div className="flex flex-col items-end gap-px leading-tight">
      <span
        className={cn(
          'font-mono text-xs tabular-nums',
          tone === 'bull' ? 'text-signal-bull' : 'text-signal-bear',
        )}
      >
        {usd != null ? formatCompactUsd(usd) : '—'}
      </span>
      <span className="text-[10px] font-mono text-fg-muted">{qtyLine}</span>
    </div>
  );
}
