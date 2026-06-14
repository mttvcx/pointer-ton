'use client';

import type { PredictionMarket, PredictionRecentTrade } from '@/lib/predictions/types';
import { priceFlashClass, usePriceFlash } from '@/components/predictions/usePriceFlash';
import { cn } from '@/lib/utils/cn';
import { ArrowDown, ArrowUp } from 'lucide-react';

export type PredictionQuickTradeHandler = (
  market: PredictionMarket,
  outcome: 'yes' | 'no',
) => void;

function formatAgo(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h`;
}

export function ActiveBuyStrip({
  trades,
  className,
}: {
  trades?: PredictionRecentTrade[];
  className?: string;
}) {
  if (!trades?.length) return null;
  const recent = trades.slice(0, 4);
  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {recent.map((t) => (
        <span
          key={t.id}
          className={cn(
            'inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[9px] font-medium tabular-nums ring-1',
            t.side === 'yes'
              ? 'bg-signal-bull/10 text-signal-bull ring-signal-bull/20'
              : 'bg-signal-bear/10 text-signal-bear ring-signal-bear/20',
          )}
        >
          <span className="uppercase">{t.side}</span>
          <span>{t.priceCents}¢</span>
          <span className="text-fg-muted">×{t.count}</span>
          <span className="text-fg-muted/70">{formatAgo(t.ts)}</span>
        </span>
      ))}
    </div>
  );
}

export function YesNoTradeButtons({
  market,
  onQuickTrade,
  size = 'md',
  layout = 'grid',
}: {
  market: PredictionMarket;
  onQuickTrade: (market: PredictionMarket, outcome: 'yes' | 'no') => void;
  size?: 'md' | 'lg';
  layout?: 'grid' | 'stack';
}) {
  const yesFlash = usePriceFlash(market.yesPriceCents);
  const noFlash = usePriceFlash(market.noPriceCents);
  const py = size === 'lg' ? 'py-2.5' : 'py-2';
  const text = size === 'lg' ? 'text-[12px]' : 'text-[11px]';

  const yesBtn = (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onQuickTrade(market, 'yes');
      }}
      className={cn(
        'btn-press w-full rounded-md text-center font-semibold tabular-nums transition',
        'bg-signal-bull/18 text-signal-bull ring-1 ring-signal-bull/30',
        'hover:bg-signal-bull/28 hover:ring-signal-bull/45',
        priceFlashClass(yesFlash),
        py,
        text,
      )}
    >
      <span className="inline-flex items-center justify-center gap-1">
        Yes {market.yesPriceCents}¢
        {yesFlash === 'up' ? <ArrowUp className="h-3 w-3" /> : null}
        {yesFlash === 'down' ? <ArrowDown className="h-3 w-3" /> : null}
      </span>
    </button>
  );

  const noBtn = (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onQuickTrade(market, 'no');
      }}
      className={cn(
        'btn-press w-full rounded-md text-center font-semibold tabular-nums transition',
        'bg-signal-bear/16 text-signal-bear ring-1 ring-signal-bear/28',
        'hover:bg-signal-bear/24 hover:ring-signal-bear/40',
        priceFlashClass(noFlash),
        py,
        text,
      )}
    >
      <span className="inline-flex items-center justify-center gap-1">
        No {market.noPriceCents}¢
        {noFlash === 'up' ? <ArrowUp className="h-3 w-3" /> : null}
        {noFlash === 'down' ? <ArrowDown className="h-3 w-3" /> : null}
      </span>
    </button>
  );

  if (layout === 'stack') {
    return (
      <div className="flex flex-col gap-2">
        {yesBtn}
        {noBtn}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {yesBtn}
      {noBtn}
    </div>
  );
}

export function ChanceReadout({ market }: { market: PredictionMarket }) {
  const pctFlash = usePriceFlash(market.yesPct, 0.5);
  const change = market.changeCents24h ?? market.changePct24h;
  const changeFlash = usePriceFlash(change, 0.05);

  return (
    <div className="tabular-nums">
      <div
        className={cn(
          'font-mono text-2xl font-bold text-fg-primary transition-colors',
          priceFlashClass(pctFlash),
        )}
      >
        {market.yesPct}%
      </div>
      <div
        className={cn(
          'mt-0.5 inline-flex items-center gap-0.5 text-[11px] font-semibold',
          change >= 0 ? 'text-signal-bull' : 'text-signal-bear',
          priceFlashClass(changeFlash),
        )}
      >
        {change >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
        {change >= 0 ? '+' : ''}
        {Math.abs(change).toFixed(1)}
        {market.changeCents24h != null ? '¢' : '%'}
      </div>
    </div>
  );
}
