'use client';

import { toast } from 'sonner';
import { PulseRowVolMc } from '@/components/tokens/PulseRowVolMc';
import { cn } from '@/lib/utils/cn';

const EXEC_MSG = 'Stock execution coming soon';

export function StockRowLeverageCenter({
  leverage,
  onLeverageChange,
  symbol,
}: {
  leverage: number;
  onLeverageChange: (v: number) => void;
  symbol: string;
}) {
  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-y-0 left-[38%] right-[30%] z-[15] flex items-center justify-center px-2',
        'opacity-0 transition-opacity duration-150',
        'group-hover/stockRow:pointer-events-auto group-hover/stockRow:opacity-100',
      )}
      data-row-click-skip="true"
    >
      <div className="w-full max-w-[10.5rem] rounded-md bg-bg-base/90 px-3 py-2 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.65)] backdrop-blur-sm">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="text-[9px] font-semibold uppercase tracking-wide text-fg-muted">
            Leverage
          </span>
          <span className="text-[12px] font-semibold tabular-nums text-fg-primary">{leverage}x</span>
        </div>
        <input
          type="range"
          min={1}
          max={20}
          step={0.5}
          value={leverage}
          onChange={(e) => onLeverageChange(Number.parseFloat(e.target.value))}
          onClick={(e) => e.stopPropagation()}
          className="h-1 w-full cursor-pointer accent-accent-primary"
          aria-label={`Leverage for ${symbol}`}
        />
      </div>
    </div>
  );
}

export function StockRowTradeDock({
  volume24hUsd,
  marketCapUsd,
  mcTone,
  leverage,
  symbol,
}: {
  volume24hUsd: number;
  marketCapUsd: number;
  mcTone: 'cyan' | 'gold';
  leverage: number;
  symbol: string;
}) {
  function onTrade(side: 'long' | 'short') {
    toast.message(EXEC_MSG, {
      description: `${side === 'long' ? 'Long' : 'Short'} ${symbol} · ${leverage}x`,
    });
  }

  return (
    <div className="stock-row-action pointer-events-none absolute inset-y-0 right-0 z-20 flex w-[clamp(7.5rem,32%,14rem)] items-stretch justify-end pl-2 pr-0">
      <div className="pointer-events-auto relative z-[21] flex h-full min-h-0 w-full flex-col">
        <div className="pointer-events-none absolute inset-x-0 top-4 z-[22] flex justify-end pr-3">
          <PulseRowVolMc
            vol={volume24hUsd}
            mcUsd={marketCapUsd}
            showVol
            showMc
            size="prominent"
            justify="end"
            layout="inline"
            mcTone={mcTone}
          />
        </div>

        <div className="relative z-[21] flex min-h-0 flex-1 flex-col items-end justify-end gap-1.5 pb-2.5 pr-3">
          {/* Idle — plain Long label, no outline */}
          <button
            type="button"
            data-row-click-skip="true"
            onClick={() => onTrade('long')}
            className={cn(
              'text-[11px] font-semibold text-signal-bull transition-opacity duration-150',
              'group-hover/stockRow:pointer-events-none group-hover/stockRow:opacity-0',
            )}
            aria-label={`Long ${symbol}`}
          >
            Long
          </button>

          {/* Hover — borderless Long / Short */}
          <div
            className={cn(
              'pointer-events-none flex gap-1.5 opacity-0 transition-opacity duration-150',
              'group-hover/stockRow:pointer-events-auto group-hover/stockRow:opacity-100',
            )}
          >
            <button
              type="button"
              data-row-click-skip="true"
              onClick={() => onTrade('long')}
              className="btn-press focus-ring h-7 rounded-md bg-signal-bull/15 px-3 text-[11px] font-bold text-signal-bull transition hover:bg-signal-bull/25"
            >
              Long
            </button>
            <button
              type="button"
              data-row-click-skip="true"
              onClick={() => onTrade('short')}
              className="btn-press focus-ring h-7 rounded-md bg-signal-bear/15 px-3 text-[11px] font-bold text-signal-bear transition hover:bg-signal-bear/25"
            >
              Short
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
