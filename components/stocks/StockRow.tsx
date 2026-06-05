'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { StockAvatar } from '@/components/stocks/StockAvatar';
import {
  StockRowLeverageCenter,
  StockRowTradeDock,
} from '@/components/stocks/StockRowTradeDock';
import type { SyntheticStockMarket } from '@/lib/stocks/types';
import { useEntityHover } from '@/lib/hooks/useEntityHover';
import { formatPercent } from '@/lib/utils/formatters';
import { cn } from '@/lib/utils/cn';

/** Match Pulse virtualizer tabled row height. */
const ROW_SLOT_PX = 116;

export function StockRow({
  market,
  defaultLeverage = 5,
}: {
  market: SyntheticStockMarket;
  defaultLeverage?: number;
}) {
  const router = useRouter();
  const slotHeight = ROW_SLOT_PX;
  const mcTone = market.category === 'top' ? 'gold' : 'cyan';
  const changeTone = market.change24hPct >= 0 ? 'bull' : 'bear';
  const [leverage, setLeverage] = useState(defaultLeverage);

  useEffect(() => {
    setLeverage(defaultLeverage);
  }, [defaultLeverage]);

  const avatarSize = useMemo(() => {
    const verticalPad = 24;
    const raw = slotHeight - verticalPad;
    return Math.min(78, Math.max(52, Math.round(raw)));
  }, [slotHeight]);

  const hoverProps = useEntityHover({
    type: 'token',
    id: market.symbol,
    label: market.symbol,
  });

  const stockPath = `/stock/${encodeURIComponent(market.symbol)}`;
  const nameTitle = `${market.symbol} — ${market.name}`;

  const isInteractiveClickTarget = (target: EventTarget | null) =>
    target instanceof HTMLElement &&
    Boolean(target.closest('button,[role="button"],[data-row-click-skip="true"],input'));

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

  return (
    <div
      className={cn(
        'stock-row group/stockRow relative flex items-stretch rounded-lg outline-none transition-colors duration-150 ease-out',
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
              <div className="group/mintTitle flex min-w-0 max-w-full w-max flex-col gap-0.5 overflow-hidden">
                <p
                  className="inline-block w-fit max-w-full truncate rounded-sm px-0.5 -mx-0.5 font-sans leading-[1.12] transition-colors hover:bg-white/[0.05]"
                  title={nameTitle}
                >
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

      <StockRowLeverageCenter
        leverage={leverage}
        onLeverageChange={setLeverage}
        symbol={market.symbol}
      />

      <StockRowTradeDock
        volume24hUsd={market.volume24hUsd}
        marketCapUsd={market.marketCapUsd}
        mcTone={mcTone}
        leverage={leverage}
        symbol={market.symbol}
      />
    </div>
  );
}

export const STOCK_PULSE_ROW_SLOT_PX = ROW_SLOT_PX;
