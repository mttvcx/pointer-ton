'use client';

import { useRouter } from 'next/navigation';
import type { KeyboardEvent, MouseEvent } from 'react';
import { Zap } from 'lucide-react';
import { StockAvatar } from '@/components/stocks/StockAvatar';
import { PulseRowVolMc } from '@/components/tokens/PulseRowVolMc';
import type { SyntheticStockMarket } from '@/lib/stocks/types';
import { useEntityHover } from '@/lib/hooks/useEntityHover';
import { formatPercent, formatSol } from '@/lib/utils/formatters';
import { cn } from '@/lib/utils/cn';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const ROW_SLOT_PX = 116;
const EXEC_TOOLTIP = 'Stock execution coming soon';

function formatSolDraft(n: number): string {
  return formatSol(n);
}

export function StockRow({
  market,
  quickBuySol = 0.5,
  quoteSymbol = 'SOL',
}: {
  market: SyntheticStockMarket;
  quickBuySol?: number;
  quoteSymbol?: string;
}) {
  const router = useRouter();
  const slotHeight = ROW_SLOT_PX;
  const mcTone = market.category === 'top' ? 'gold' : 'cyan';
  const changeTone = market.change24hPct >= 0 ? 'bull' : 'bear';

  const hoverProps = useEntityHover({
    type: 'token',
    id: market.symbol,
    label: market.symbol,
  });

  const stockPath = `/stock/${encodeURIComponent(market.symbol)}`;
  const nameTitle = `${market.symbol} — ${market.name}`;

  const isInteractiveClickTarget = (target: EventTarget | null) =>
    target instanceof HTMLElement &&
    Boolean(target.closest('button,[role="button"],[data-row-click-skip="true"]'));

  const openStock = () => router.push(stockPath);

  const onRowClick = (e: MouseEvent<HTMLDivElement>) => {
    if (isInteractiveClickTarget(e.target)) return;
    openStock();
  };

  const onRowKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.defaultPrevented || isInteractiveClickTarget(e.target)) return;
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    openStock();
  };

  const avatarSize = 58;
  const labelAmount = formatSolDraft(quickBuySol) || String(quickBuySol);

  return (
    <div
      className={cn(
        'pulse-row group/pulseRow relative flex items-stretch rounded-lg outline-none transition-colors duration-150 ease-out',
        'h-full min-h-0 max-h-full overflow-visible',
      )}
      style={{ height: slotHeight }}
    >
      <div
        role="link"
        tabIndex={0}
        aria-label={`Open ${market.symbol}`}
        onClick={onRowClick}
        onKeyDown={onRowKeyDown}
        className={cn(
          'relative z-[1] flex min-h-0 min-w-0 flex-1 cursor-pointer items-start outline-none transition-[background-color] duration-150',
          'hover:bg-white/[0.04]',
          'focus-visible:bg-bg-hover/80 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-primary/45',
          'px-3 pt-4 pb-2 pr-[calc(clamp(7.5rem,32%,14rem)+0.5rem)]',
        )}
        {...hoverProps}
      >
        <div className="flex h-full min-h-0 w-full min-w-0 items-start gap-2.5 sm:gap-3">
          <div className="flex shrink-0 flex-col items-center gap-1.5" style={{ minWidth: avatarSize }}>
            <StockAvatar symbol={market.symbol} size={avatarSize} />
          </div>

          <div className="relative z-[1] flex min-h-0 min-w-0 flex-1 flex-col justify-start gap-2 overflow-visible">
            <div className="flex min-w-0 flex-nowrap items-center gap-2 overflow-hidden">
              <div className="group/mintTitle flex min-w-0 flex-1 flex-col gap-0.5 overflow-hidden rounded-sm px-0.5 -mx-0.5 transition-colors hover:bg-white/[0.05]">
                <p className="min-w-0 truncate font-sans leading-[1.12]" title={nameTitle}>
                  <span className="text-[16px] font-semibold tracking-tight text-fg-primary">
                    {market.symbol}
                  </span>
                  <span className="ml-1.5 text-[15px] font-normal tracking-tight text-fg-secondary">
                    {market.name}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-1.5 overflow-visible">
              <div className="flex min-w-0 flex-nowrap items-start gap-2 overflow-visible">
                <span
                  className={cn(
                    'shrink-0 whitespace-nowrap text-[13px] leading-none',
                    changeTone === 'bull' ? 'font-medium text-signal-bull' : 'text-signal-bear',
                  )}
                >
                  {formatPercent(market.change24hPct, { sign: true })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="pulse-row-action pointer-events-none absolute inset-y-0 right-0 z-20 flex items-stretch justify-end pl-3 pr-0">
        <div className="pointer-events-auto relative z-[21] flex h-full min-h-0 w-[clamp(7.5rem,32%,14rem)] min-w-0 shrink-0 flex-col gap-0.5">
          <div className="pointer-events-none absolute inset-x-0 top-4 z-[22] flex justify-end pl-0.5 pr-3">
            <PulseRowVolMc
              vol={market.volume24hUsd}
              mcUsd={market.marketCapUsd}
              showVol
              showMc
              size="prominent"
              justify="end"
              layout="inline"
              mcTone={mcTone}
            />
          </div>
          <div className="relative z-[21] flex min-h-0 flex-1 items-stretch justify-end gap-1.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  disabled
                  data-row-click-skip="true"
                  className={cn(
                    'focus-ring relative z-[21] flex h-full w-full min-h-0 max-h-full max-w-full flex-col items-end justify-end rounded-[5px] border p-2 pb-2.5 pr-2.5 font-sans font-semibold tabular-nums tracking-normal transition-all duration-200',
                    'border-emerald-400/90 bg-transparent text-emerald-400 opacity-55',
                  )}
                  aria-label={`Quick buy ${labelAmount} ${quoteSymbol}`}
                >
                  <span className="flex shrink-0 items-center gap-1 text-[10px] leading-none sm:text-[11px]">
                    <Zap className="h-3 w-3 shrink-0 fill-emerald-400/35 text-emerald-400 sm:h-3.5 sm:w-3.5" aria-hidden />
                    <span className="min-w-0 text-right">{`${labelAmount} ${quoteSymbol}`}</span>
                  </span>
                </button>
              </TooltipTrigger>
              <TooltipContent>{EXEC_TOOLTIP}</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  );
}

export const STOCK_PULSE_ROW_SLOT_PX = ROW_SLOT_PX;
