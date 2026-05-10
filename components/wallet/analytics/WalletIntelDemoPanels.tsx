'use client';

import { formatCompactUsd } from '@/lib/utils/formatters';
import { cn } from '@/lib/utils/cn';
import type { DemoActivityRow, DemoTop100Row, DemoTransferRow } from '@/lib/dev/demoWalletIntelRows';

export function WalletIntelActivityDemo({ rows }: { rows: DemoActivityRow[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border-subtle/80">
      <table className="w-full min-w-[520px] border-collapse text-left text-[11px]">
        <thead>
          <tr className="border-b border-border-subtle/80 bg-black/25 text-[10px] uppercase tracking-wide text-fg-muted">
            <th className="px-3 py-2 font-semibold">Time</th>
            <th className="px-3 py-2 font-semibold">Type</th>
            <th className="px-3 py-2 font-semibold">Detail</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-border-subtle/40 hover:bg-bg-hover/60">
              <td className="px-3 py-2 tabular-nums text-fg-muted">{r.timeLabel}</td>
              <td
                className={cn(
                  'px-3 py-2 font-semibold',
                  r.tone === 'bull' && 'text-signal-bull',
                  r.tone === 'bear' && 'text-signal-bear',
                  r.tone === 'muted' && 'text-fg-secondary',
                )}
              >
                {r.label}
              </td>
              <td className="px-3 py-2 text-fg-secondary">{r.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-border-subtle/50 px-3 py-2 text-[10px] text-fg-muted">
        Demo activity rows — indexer feed wiring is separate.
      </p>
    </div>
  );
}

export function WalletIntelTop100Demo({ rows }: { rows: DemoTop100Row[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border-subtle/80">
      <table className="w-full min-w-[480px] border-collapse text-left text-[11px]">
        <thead>
          <tr className="border-b border-border-subtle/80 bg-black/25 text-[10px] uppercase tracking-wide text-fg-muted">
            <th className="px-3 py-2 font-semibold">#</th>
            <th className="px-3 py-2 font-semibold">Entity</th>
            <th className="px-3 py-2 text-right font-semibold">Volume</th>
            <th className="px-3 py-2 text-right font-semibold">PnL</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.rank} className="border-b border-border-subtle/40 hover:bg-bg-hover/60">
              <td className="px-3 py-2 tabular-nums text-fg-muted">{r.rank}</td>
              <td className="px-3 py-2 font-medium text-fg-primary">{r.label}</td>
              <td className="px-3 py-2 text-right tabular-nums text-fg-secondary">
                {formatCompactUsd(r.volumeUsd)}
              </td>
              <td
                className={cn(
                  'px-3 py-2 text-right tabular-nums font-semibold',
                  r.pnlUsd >= 0 ? 'text-signal-bull' : 'text-signal-bear',
                )}
              >
                {formatCompactUsd(r.pnlUsd)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-border-subtle/50 px-3 py-2 text-[10px] text-fg-muted">
        Demo leaderboard slice — not on-chain verified.
      </p>
    </div>
  );
}

export function WalletIntelTransfersDemo({ rows }: { rows: DemoTransferRow[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border-subtle/80">
      <table className="w-full min-w-[420px] border-collapse text-left text-[11px]">
        <thead>
          <tr className="border-b border-border-subtle/80 bg-black/25 text-[10px] uppercase tracking-wide text-fg-muted">
            <th className="px-3 py-2 font-semibold">Direction</th>
            <th className="px-3 py-2 font-semibold">Asset</th>
            <th className="px-3 py-2 font-semibold">Amount</th>
            <th className="px-3 py-2 font-semibold">When</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-border-subtle/40 hover:bg-bg-hover/60">
              <td
                className={cn(
                  'px-3 py-2 font-semibold',
                  r.dir === 'In' ? 'text-signal-bull' : 'text-signal-bear',
                )}
              >
                {r.dir}
              </td>
              <td className="px-3 py-2 text-fg-secondary">{r.asset}</td>
              <td className="px-3 py-2 tabular-nums text-fg-primary">{r.amount}</td>
              <td className="px-3 py-2 tabular-nums text-fg-muted">{r.timeLabel}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-border-subtle/50 px-3 py-2 text-[10px] text-fg-muted">
        Demo transfers — RPC-backed history ships separately.
      </p>
    </div>
  );
}
