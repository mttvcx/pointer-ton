'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import { RefreshCw, RotateCcw, Share2 } from 'lucide-react';
import { SolGlyph } from '@/components/chains/SolGlyph';
import { cn } from '@/lib/utils/cn';
import { toast } from 'sonner';

type PnlUnit = 'sol' | 'usd';

/** Compact Balance / PNL row for squad context. */
export function SquadsLobbyStatsStrip({
  balanceSol = 0,
  pnlSol = 0,
  className,
}: {
  balanceSol?: number;
  pnlSol?: number;
  className?: string;
}) {
  const [unit, setUnit] = useState<PnlUnit>('sol');
  const pnlPositive = pnlSol >= 0;
  const pnlLabel = `${pnlPositive ? '+' : ''}${pnlSol.toFixed(unit === 'usd' ? 0 : 1)}`;

  return (
    <div
      className={cn(
        'group/stats relative shrink-0 border-b border-border-subtle px-4 py-3',
        className,
      )}
    >
      <div
        className={cn(
          'pointer-events-none absolute inset-x-3 inset-y-2 flex items-center justify-between opacity-0 transition-opacity duration-150',
          'group-hover/stats:pointer-events-auto group-hover/stats:opacity-100',
        )}
      >
        <div className="flex items-center gap-1.5">
          <HoverBtn title="Share squad PnL" onClick={() => toast.message('Squad PnL link copied')}>
            <Share2 className="h-3.5 w-3.5" strokeWidth={2} />
          </HoverBtn>
          <HoverBtn
            title={unit === 'sol' ? 'Switch to USD' : 'Switch to SOL'}
            onClick={() => setUnit((u) => (u === 'sol' ? 'usd' : 'sol'))}
          >
            <RefreshCw className="h-3.5 w-3.5" strokeWidth={2} />
          </HoverBtn>
        </div>
        <HoverBtn title="Reset PNL" onClick={() => toast.message('Squad PnL reset')}>
          <RotateCcw className="h-3.5 w-3.5" strokeWidth={2} />
        </HoverBtn>
      </div>

      <div className="flex items-center justify-center gap-10 transition-opacity duration-150 group-hover/stats:opacity-[0.06]">
        <Metric label="Balance" unit={unit}>
          {unit === 'usd' ? `$${balanceSol.toFixed(0)}` : balanceSol.toFixed(1)}
        </Metric>
        <Metric label="PNL" unit={unit} accent={pnlPositive ? 'bull' : 'bear'}>
          {unit === 'usd'
            ? pnlPositive
              ? `+$${Math.abs(pnlSol).toFixed(0)}`
              : `-$${Math.abs(pnlSol).toFixed(0)}`
            : pnlLabel}
        </Metric>
      </div>
    </div>
  );
}

function HoverBtn({
  children,
  title,
  onClick,
}: {
  children: ReactNode;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className="btn-press flex h-7 w-7 items-center justify-center rounded-full border border-border-subtle bg-bg-raised/95 text-fg-muted backdrop-blur-sm transition hover:border-border-default hover:bg-bg-hover hover:text-fg-primary"
    >
      {children}
    </button>
  );
}

function Metric({
  label,
  unit,
  accent,
  children,
}: {
  label: string;
  unit: PnlUnit;
  accent?: 'bull' | 'bear';
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center gap-1.5">
        {unit === 'sol' ? <SolGlyph size={20} /> : null}
        <span
          className={cn(
            'text-[26px] font-semibold leading-none tabular-nums tracking-tight',
            accent === 'bull' && 'text-signal-bull',
            accent === 'bear' && 'text-signal-bear',
            !accent && 'text-fg-primary',
          )}
        >
          {children}
        </span>
      </div>
      <span className="text-[11px] text-fg-muted">{label}</span>
    </div>
  );
}
