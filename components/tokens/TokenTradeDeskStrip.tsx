'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils/cn';
import { formatCompactUsd, formatNumber } from '@/lib/utils/formatters';
import type { TokenExtendedMetrics } from '@/lib/types/tokenExtendedMetrics';
import { tapeMetricsForTf } from '@/lib/tokens/tokenTradeTapeByTf';
import {
  formatTradePerfPct,
  TOKEN_TRADE_PERF_TFS,
  type TokenTradePerfTf,
} from '@/lib/tokens/tokenTradePerfTfs';

function formatTapeCount(n: number): string {
  if (n >= 1_000) return formatNumber(n, { compact: true, decimals: n >= 10_000 ? 1 : 2 });
  return formatNumber(n, { decimals: 0 });
}

/** Axiom-style $ — one decimal on K/M/B, two decimals under $1K. */
function formatTapeUsd(value: number): string {
  if (!Number.isFinite(value)) return '\u2014';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs < 1_000) return formatCompactUsd(value);
  return `${sign}$${new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(abs)}`;
}

/**
 * Axiom-style trade desk row — one slot above Buy/Sell.
 * Default: vol / buys / sells / net for the selected TF.
 * Hover → 5m · 1h · 6h · 24h picker. Click a window to switch.
 */
export function TokenTradeDeskStrip({
  metrics,
  mint,
  changes,
  selected,
  onSelect,
  className,
}: {
  metrics: TokenExtendedMetrics;
  mint: string;
  changes: Record<TokenTradePerfTf, number | null>;
  selected: TokenTradePerfTf;
  onSelect: (tf: TokenTradePerfTf) => void;
  className?: string;
}) {
  const [hovering, setHovering] = useState(false);

  const showStats = !hovering;
  const tape = tapeMetricsForTf(metrics, selected, mint);
  const indexedTape = tape != null;
  const dash = '\u2014';

  const dexAggregate = tape?.dexAggregate === true;
  const txnTotal = tape != null ? tape.buys + tape.sells : 0;
  const usdSplitKnown = tape != null && !dexAggregate && txnTotal > 0;

  const volTotal = tape && usdSplitKnown ? tape.buyVolUsd + tape.sellVolUsd : 0;
  const buyRatio =
    tape == null
      ? 0.5
      : usdSplitKnown && volTotal > 0
        ? tape.buyVolUsd / volTotal
        : txnTotal > 0
          ? tape.buys / txnTotal
          : 0.5;
  const hasActivity =
    indexedTape && tape != null && (tape.volUsd > 0 || tape.buys > 0 || tape.sells > 0);
  const showRatioBar = hasActivity && (usdSplitKnown ? volTotal > 0 : txnTotal > 0);

  const pickTf = (tf: TokenTradePerfTf) => {
    onSelect(tf);
  };

  const volLabel = selected === '24h' ? '24h Vol' : `${selected} Vol`;

  return (
    <div
      className={cn('min-w-0 font-sans', className)}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {showStats ? (
        <div className="min-h-[3.75rem] py-0.5">
          <div className="grid grid-cols-4 gap-x-2">
            <div className="min-w-0">
              <p className="whitespace-nowrap text-[11px] font-medium leading-none text-fg-muted/80">
                {volLabel}
              </p>
              <p className="mt-1 whitespace-nowrap text-[12px] font-semibold tabular-nums leading-none text-fg-primary">
                {indexedTape && tape ? formatCompactUsd(tape.volUsd) : dash}
              </p>
            </div>
            <div className="min-w-0">
              <p className="whitespace-nowrap text-[11px] font-medium leading-none text-fg-muted/80">
                Buys
              </p>
              <p className="mt-1 whitespace-nowrap text-[11px] font-semibold tabular-nums leading-none text-signal-bull">
                {indexedTape && tape && txnTotal > 0
                  ? usdSplitKnown
                    ? `${formatTapeCount(tape.buys)} / ${formatTapeUsd(tape.buyVolUsd)}`
                    : formatTapeCount(tape.buys)
                  : dash}
              </p>
            </div>
            <div className="min-w-0">
              <p className="whitespace-nowrap text-[11px] font-medium leading-none text-fg-muted/80">
                Sells
              </p>
              <p className="mt-1 whitespace-nowrap text-[11px] font-semibold tabular-nums leading-none text-signal-bear">
                {indexedTape && tape && txnTotal > 0
                  ? usdSplitKnown
                    ? `${formatTapeCount(tape.sells)} / ${formatTapeUsd(tape.sellVolUsd)}`
                    : formatTapeCount(tape.sells)
                  : dash}
              </p>
            </div>
            <div className="min-w-0 text-right">
              <p className="whitespace-nowrap text-[11px] font-medium leading-none text-fg-muted/80">
                Net Vol.
              </p>
              <p
                className={cn(
                  'mt-1 whitespace-nowrap text-[12px] font-semibold tabular-nums leading-none',
                  !usdSplitKnown
                    ? 'text-fg-muted'
                    : tape && tape.netVolUsd < 0
                      ? 'text-signal-bear'
                      : 'text-signal-bull',
                )}
              >
                {usdSplitKnown && tape ? formatTapeUsd(tape.netVolUsd) : dash}
              </p>
            </div>
          </div>

          {showRatioBar ? (
            <div className="mt-2 flex h-[2px] w-full overflow-hidden">
              <div
                className="h-full bg-signal-bull"
                style={{ width: `${Math.max(0, Math.min(100, buyRatio * 100))}%` }}
              />
              <div className="h-full flex-1 bg-signal-bear" />
            </div>
          ) : null}
        </div>
      ) : (
        <div className="grid min-h-[3.75rem] grid-cols-4 gap-0">
          {TOKEN_TRADE_PERF_TFS.map((tf) => {
            const pct = changes[tf];
            const isSelected = selected === tf;
            const pos = (pct ?? 0) >= 0;

            return (
              <button
                key={tf}
                type="button"
                aria-pressed={isSelected}
                onClick={() => pickTf(tf)}
                className={cn(
                  'focus-ring flex min-h-[3.75rem] flex-col items-center justify-center rounded-md px-1 py-2',
                  'transition-colors duration-150',
                  isSelected
                    ? 'bg-white/[0.05] text-fg-primary'
                    : 'text-fg-muted hover:bg-white/[0.03] hover:text-fg-secondary',
                )}
              >
                <span className="text-[11px] font-semibold leading-none">{tf}</span>
                <span
                  className={cn(
                    'mt-1 h-[2px] w-5 rounded-full',
                    isSelected ? 'bg-signal-bull' : 'bg-transparent',
                  )}
                  aria-hidden
                />
                <span
                  className={cn(
                    'mt-1 text-[10px] font-medium tabular-nums leading-none',
                    pos ? 'text-signal-bull' : 'text-signal-bear',
                  )}
                >
                  {formatTradePerfPct(pct)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
