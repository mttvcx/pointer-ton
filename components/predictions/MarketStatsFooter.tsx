'use client';

import { useState } from 'react';
import { formatPredictionUsd } from '@/components/predictions/formatPrediction';
import { cn } from '@/lib/utils/cn';

type StatCellProps = {
  value: string;
  label: string;
  accent?: 'blue' | 'white' | 'muted';
  tooltip?: string;
};

function StatCell({ value, label, accent = 'white', tooltip }: StatCellProps) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="group/stat relative min-w-0"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <p
        className={cn(
          'font-mono text-[13px] font-semibold tabular-nums leading-none',
          accent === 'blue' && 'text-accent-primary',
          accent === 'white' && 'text-fg-primary',
          accent === 'muted' && 'text-fg-secondary',
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-fg-muted/80">
        {label}
      </p>
      {tooltip && open ? (
        <div className="pointer-events-none absolute bottom-full left-0 z-20 mb-1.5 max-w-[220px] rounded-md border border-border-subtle/80 bg-bg-raised px-2.5 py-1.5 text-[10px] leading-snug text-fg-secondary shadow-lg">
          {tooltip}
        </div>
      ) : null}
    </div>
  );
}

export function MarketStatsFooter({
  volumeUsd,
  liquidityUsd,
  endsIn,
  closeTime,
  className,
}: {
  volumeUsd: number;
  liquidityUsd: number;
  endsIn: string;
  closeTime?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-end justify-between gap-4 border-t border-border-subtle/40 pt-2.5',
        className,
      )}
    >
      <StatCell
        value={formatPredictionUsd(volumeUsd)}
        label="24H VOL"
        accent="blue"
        tooltip="Contract notional traded on Kalshi in the last 24 hours."
      />
      <StatCell
        value={formatPredictionUsd(liquidityUsd)}
        label="LIQUIDITY"
        accent="white"
        tooltip="Resting order liquidity available at current prices."
      />
      <StatCell
        value={endsIn}
        label="CLOSES"
        accent="muted"
        tooltip={
          closeTime
            ? `Market closes ${new Date(closeTime).toLocaleString()}`
            : 'Time until market resolution.'
        }
      />
    </div>
  );
}
