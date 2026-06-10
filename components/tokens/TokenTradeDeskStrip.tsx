'use client';

import { cn } from '@/lib/utils/cn';
import { formatCompactUsd, formatNumber } from '@/lib/utils/formatters';
import type { TokenExtendedMetrics } from '@/lib/types/tokenExtendedMetrics';
import { tapeMetricsForTf } from '@/lib/tokens/tokenTradeTapeByTf';
import {
  formatTradePerfPct,
  TOKEN_TRADE_PERF_TFS,
  type TokenTradePerfTf,
} from '@/lib/tokens/tokenTradePerfTfs';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

function formatTapeCount(n: number): string {
  if (n >= 1_000) return formatNumber(n, { compact: true, decimals: n >= 10_000 ? 1 : 2 });
  return formatNumber(n, { decimals: 0 });
}

/** Shorter $ for tight tape columns — one decimal on K/M/B. */
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

function volLabel(tf: TokenTradePerfTf, partial: boolean, dexFallback: boolean): string {
  const base = `${tf} Vol`;
  if (partial) return `${base}*`;
  if (dexFallback) return `${base}†`;
  return base;
}

/**
 * Axiom-style trade desk row — one slot above Buy/Sell.
 * TF tabs stay visible; stats update for the selected window.
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
  const tape = tapeMetricsForTf(metrics, selected, mint);
  const indexed = metrics.tapeByTf?.[selected];
  const dexFallback = Boolean(
    tape &&
      tape.volUsd > 0 &&
      (!indexed || indexed.volUsd <= 0) &&
      metrics.dexTapeByTf?.[selected],
  );
  const isPartial = metrics.indexedVolPartial?.[selected] ?? false;
  const hasTape = tape != null;
  const volTotal = tape ? tape.buyVolUsd + tape.sellVolUsd : 0;
  const buyRatio = volTotal > 0 && tape ? tape.buyVolUsd / volTotal : 0.5;
  const dash = '\u2014';
  const hasActivity = hasTape && tape && (tape.volUsd > 0 || tape.buys > 0 || tape.sells > 0);
  const showBuySell = hasTape && tape && !dexFallback;

  const labelNode = (
    <p className="whitespace-nowrap text-[11px] font-medium leading-none text-fg-primary">
      {volLabel(selected, isPartial, dexFallback)}
    </p>
  );

  return (
    <div className={cn('min-w-0 space-y-2 font-sans', className)}>
      <div className="grid grid-cols-4 gap-px rounded-md bg-border-subtle/20 p-px">
        {TOKEN_TRADE_PERF_TFS.map((tf) => {
          const pct = changes[tf];
          const isSelected = selected === tf;

          return (
            <button
              key={tf}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelect(tf)}
              className={cn(
                'focus-ring flex min-h-[2.75rem] flex-col items-center justify-center rounded-[5px] px-1 py-1.5',
                'transition-colors duration-150',
                isSelected
                  ? 'bg-bg-hover text-fg-primary'
                  : 'bg-bg-raised text-fg-muted hover:bg-bg-hover/80 hover:text-fg-secondary',
              )}
            >
              <span className="text-[11px] font-semibold leading-none">{tf}</span>
              <span
                className={cn(
                  'mt-1 text-[10px] font-medium tabular-nums leading-none',
                  (pct ?? 0) >= 0 ? 'text-signal-bull' : 'text-signal-bear',
                )}
              >
                {formatTradePerfPct(pct)}
              </span>
            </button>
          );
        })}
      </div>

      <div className="min-h-[3.5rem] py-0.5">
        <div className="grid grid-cols-[minmax(0,0.85fr)_minmax(0,1.35fr)_minmax(0,1.35fr)_minmax(0,0.85fr)] gap-x-1">
          <div className="min-w-0">
            {isPartial || dexFallback ? (
              <Tooltip>
                <TooltipTrigger asChild>{labelNode}</TooltipTrigger>
                <TooltipContent side="top" className="max-w-[220px] text-[10px] leading-snug">
                  {isPartial
                    ? 'Indexed swap history does not cover the full window yet.'
                    : 'Volume from DexScreener — buy/sell split unavailable for this window.'}
                </TooltipContent>
              </Tooltip>
            ) : (
              labelNode
            )}
            <p className="mt-1.5 whitespace-nowrap text-[12px] font-semibold tabular-nums leading-none text-fg-primary">
              {hasTape && tape ? formatCompactUsd(tape.volUsd) : dash}
            </p>
          </div>
          <div className="min-w-0">
            <p className="whitespace-nowrap text-[11px] font-medium leading-none text-fg-muted/80">
              Buys
            </p>
            <p className="mt-1.5 whitespace-nowrap text-[11px] font-semibold tabular-nums leading-none text-signal-bull">
              {showBuySell
                ? `${formatTapeCount(tape.buys)} / ${formatTapeUsd(tape.buyVolUsd)}`
                : dash}
            </p>
          </div>
          <div className="min-w-0">
            <p className="whitespace-nowrap text-[11px] font-medium leading-none text-fg-muted/80">
              Sells
            </p>
            <p className="mt-1.5 whitespace-nowrap text-[11px] font-semibold tabular-nums leading-none text-signal-bear">
              {showBuySell
                ? `${formatTapeCount(tape.sells)} / ${formatTapeUsd(tape.sellVolUsd)}`
                : dash}
            </p>
          </div>
          <div className="min-w-0 text-right">
            <p className="whitespace-nowrap text-[11px] font-medium leading-none text-fg-muted/80">
              Net Vol.
            </p>
            <p
              className={cn(
                'mt-1.5 whitespace-nowrap text-[12px] font-semibold tabular-nums leading-none',
                !showBuySell
                  ? 'text-fg-muted'
                  : tape && tape.netVolUsd < 0
                    ? 'text-signal-bear'
                    : 'text-signal-bull',
              )}
            >
              {showBuySell ? (
                <>
                  {tape.netVolUsd >= 0 ? '+' : ''}
                  {formatCompactUsd(tape.netVolUsd)}
                </>
              ) : (
                dash
              )}
            </p>
          </div>
        </div>

        {hasActivity && showBuySell ? (
          <div className="mt-2 flex h-[3px] w-full overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full bg-signal-bull/90"
              style={{ width: `${Math.max(0, Math.min(100, buyRatio * 100))}%` }}
            />
            <div className="h-full flex-1 bg-signal-bear/90" />
          </div>
        ) : null}
      </div>
    </div>
  );
}
