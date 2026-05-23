'use client';

import { ArrowUp, Layers, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { shortenAddress } from '@/lib/utils/addresses';
import { buildSharedFundingPopoverRows } from '@/lib/tokens/holderDeskSynth';

type FundingSharedPopoverProps = {
  fundedCount: number;
  totalSol: string;
  /** Seed for deterministic demo wallet rows (venue or funding wallet). */
  seed?: string;
  className?: string;
};

/** Axiom-style "Shared Funding" hover card for funding column cells. */
export function FundingSharedPopover({
  fundedCount,
  totalSol,
  seed = 'shared-fund',
  className,
}: FundingSharedPopoverProps) {
  const rows = buildSharedFundingPopoverRows(seed, fundedCount, totalSol);

  return (
    <div
      className={cn(
        'z-50 w-[220px] rounded-lg border border-border-subtle bg-bg-raised p-3 shadow-panel',
        className,
      )}
    >
      <div className="flex items-center">
        <Wallet className="h-3.5 w-3.5 shrink-0 text-fg-muted" strokeWidth={2} aria-hidden />
        <span className="ml-1.5 text-[12px] font-medium text-fg-primary">Shared Funding</span>
      </div>

      <div className="my-2 border-b border-border-subtle" />

      <div className="grid grid-cols-2 gap-x-4">
        <div>
          <div className="text-[18px] font-semibold font-mono tabular-nums text-fg-primary">
            {fundedCount}
          </div>
          <div className="mt-0.5 text-[10px] uppercase tracking-wide text-fg-muted">Funded</div>
        </div>
        <div>
          <div className="text-[18px] font-semibold font-mono tabular-nums text-fg-primary">
            {totalSol}
          </div>
          <div className="mt-0.5 text-[10px] uppercase tracking-wide text-fg-muted">Total</div>
        </div>
      </div>

      <div className="my-2 border-b border-border-subtle" />

      <div className="flex flex-col gap-2.5">
        {rows.map((row) => (
          <div key={row.address}>
            <div className="flex items-center gap-0.5 text-[11px] font-mono text-fg-secondary">
              <ArrowUp className="h-2.5 w-2.5 shrink-0 text-fg-muted" strokeWidth={2} aria-hidden />
              <span>{shortenAddress(row.address, 5)}</span>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] font-mono text-fg-secondary">
              <span>{row.ageSinceFund}</span>
              <span className="text-fg-muted/30">·</span>
              <span className="inline-flex items-center gap-0.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/chains/sol.png" alt="" width={10} height={10} className="h-2.5 w-2.5 opacity-80" />
                <span>{row.solAmount}</span>
              </span>
              <span className="text-fg-muted/30">·</span>
              <span className="inline-flex items-center gap-0.5">
                <Layers className="h-2.5 w-2.5 text-fg-muted/70" strokeWidth={2} aria-hidden />
                <span>{row.walletCount}</span>
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
