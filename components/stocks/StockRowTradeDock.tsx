'use client';

import { PulseRowVolMc } from '@/components/tokens/PulseRowVolMc';
import { cn } from '@/lib/utils/cn';

/**
 * Spot xStocks dock: 24h volume / market cap + a single Buy action. No leverage —
 * xStocks are 1:1 spot tokens, so the old perps-style leverage slider + Long/Short
 * were removed. "Buy" opens the real /token/[mint] trade page (Jupiter swap).
 */
export function StockRowTradeDock({
  volume24hUsd,
  marketCapUsd,
  mcTone,
  symbol,
  onBuy,
}: {
  volume24hUsd: number;
  marketCapUsd: number;
  mcTone: 'cyan' | 'gold';
  symbol: string;
  onBuy: () => void;
}) {
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

        <div className="relative z-[21] flex min-h-0 flex-1 flex-col items-end justify-end pb-2.5 pr-3">
          {/* Idle — plain Buy label */}
          <span
            className={cn(
              'text-[11px] font-semibold text-signal-bull transition-opacity duration-150',
              'group-hover/stockRow:pointer-events-none group-hover/stockRow:opacity-0',
            )}
          >
            Buy
          </span>

          {/* Hover — actionable Buy → real token trade page */}
          <button
            type="button"
            data-row-click-skip="true"
            onClick={onBuy}
            className={cn(
              'btn-press focus-ring absolute bottom-2.5 right-3 h-7 rounded-md bg-signal-bull/15 px-4 text-[11px] font-bold text-signal-bull transition',
              'pointer-events-none opacity-0 hover:bg-signal-bull/25',
              'group-hover/stockRow:pointer-events-auto group-hover/stockRow:opacity-100',
            )}
            aria-label={`Buy ${symbol}`}
          >
            Buy
          </button>
        </div>
      </div>
    </div>
  );
}
