'use client';

import { formatCompactUsd } from '@/lib/utils/formatters';
import { cn } from '@/lib/utils/cn';
import type { DemoActivityRow, DemoTop100Row, DemoTransferRow } from '@/lib/dev/demoWalletIntelRows';

export function WalletIntelActivityDemo({ rows }: { rows: DemoActivityRow[] }) {
  return (
    <div className="overflow-x-auto rounded-b-lg border border-t-0 border-white/[0.07] bg-[#070a0f]/45">
      <table className="w-full min-w-[520px] border-collapse text-left text-[11px]">
        <thead>
          <tr className="border-b border-white/[0.065] bg-white/[0.018] text-[8.5px] uppercase tracking-[0.09em] text-fg-muted/90">
            <th className="px-3 py-1.5 font-semibold">Time</th>
            <th className="px-3 py-1.5 font-semibold">Type</th>
            <th className="px-3 py-1.5 font-semibold">Detail</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-white/[0.035] hover:bg-white/[0.028]">
              <td className="px-3 py-2 tabular-nums text-fg-muted">{r.timeLabel}</td>
              <td
                className={cn(
                  'px-3 py-2 font-semibold',
                  r.tone === 'bull' && 'text-emerald-300/90',
                  r.tone === 'bear' && 'text-rose-300/90',
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
      <p className="border-t border-white/[0.045] px-3 py-1.5 text-[9.5px] text-fg-muted">
        Demo activity rows
      </p>
    </div>
  );
}

export function WalletIntelTop100Demo({ rows }: { rows: DemoTop100Row[] }) {
  return (
    <div className="overflow-x-auto rounded-b-lg border border-t-0 border-white/[0.07] bg-[#070a0f]/45">
      <table className="w-full min-w-[480px] border-collapse text-left text-[11px]">
        <thead>
          <tr className="border-b border-white/[0.065] bg-white/[0.018] text-[8.5px] uppercase tracking-[0.09em] text-fg-muted/90">
            <th className="px-3 py-1.5 font-semibold">#</th>
            <th className="px-3 py-1.5 font-semibold">Entity</th>
            <th className="px-3 py-1.5 text-right font-semibold">Volume</th>
            <th className="px-3 py-1.5 text-right font-semibold">PnL</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.rank} className="border-b border-white/[0.035] hover:bg-white/[0.028]">
              <td className="px-3 py-2 tabular-nums text-fg-muted">{r.rank}</td>
              <td className="px-3 py-2 font-medium text-fg-primary">{r.label}</td>
              <td className="px-3 py-2 text-right tabular-nums text-fg-secondary">
                {formatCompactUsd(r.volumeUsd)}
              </td>
              <td
                className={cn(
                  'px-3 py-2 text-right tabular-nums font-semibold',
                  r.pnlUsd >= 0 ? 'text-emerald-300/90' : 'text-rose-300/90',
                )}
              >
                {formatCompactUsd(r.pnlUsd)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-white/[0.045] px-3 py-1.5 text-[9.5px] text-fg-muted">
        Demo leaderboard slice
      </p>
    </div>
  );
}

export function WalletIntelTransfersDemo({ rows }: { rows: DemoTransferRow[] }) {
  return (
    <div className="overflow-x-auto rounded-b-lg border border-t-0 border-white/[0.07] bg-[#070a0f]/45">
      <table className="w-full min-w-[420px] border-collapse text-left text-[11px]">
        <thead>
          <tr className="border-b border-white/[0.065] bg-white/[0.018] text-[8.5px] uppercase tracking-[0.09em] text-fg-muted/90">
            <th className="px-3 py-1.5 font-semibold">Direction</th>
            <th className="px-3 py-1.5 font-semibold">Asset</th>
            <th className="px-3 py-1.5 font-semibold">Amount</th>
            <th className="px-3 py-1.5 font-semibold">When</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-white/[0.035] hover:bg-white/[0.028]">
              <td
                className={cn(
                  'px-3 py-2 font-semibold',
                  r.dir === 'In' ? 'text-emerald-300/90' : 'text-rose-300/90',
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
      <p className="border-t border-white/[0.045] px-3 py-1.5 text-[9.5px] text-fg-muted">
        Demo transfers
      </p>
    </div>
  );
}
