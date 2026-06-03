'use client';

import { PerpMarketPicker } from '@/components/perps/PerpMarketPicker';
import { PERPS_PINNED_COINS } from '@/lib/hyperliquid/constants';
import { fmtPerpUsdCompact } from '@/lib/hyperliquid/markets';
import type { PerpMarket } from '@/lib/perps/types';
import { cn } from '@/lib/utils/cn';
import { formatNumber } from '@/lib/utils/formatters';

function priceDecimals(mark: number): number {
  if (mark >= 5000) return 0;
  if (mark >= 500) return 1;
  if (mark >= 1) return 2;
  return 4;
}

function PerpIcon({ src, size = 20 }: { src: string; size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-bg-sunken ring-1 ring-border-subtle"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" width={size - 4} height={size - 4} className="object-contain" draggable={false} />
    </span>
  );
}

function Stat({
  label,
  value,
  sub,
  valueClass,
}: {
  label: string;
  value: string;
  sub?: string;
  valueClass?: string;
}) {
  return (
    <div className="min-w-0 shrink-0">
      <div className="text-[9px] font-medium tracking-wide text-fg-muted">{label}</div>
      <div className={cn('mt-0.5 truncate text-[11px] font-semibold tabular-nums', valueClass ?? 'text-fg-primary')}>
        {value}
      </div>
      {sub ? <div className="mt-px truncate text-[9px] tabular-nums text-fg-muted">{sub}</div> : null}
    </div>
  );
}

export function PerpsMarketHeader({
  markets,
  pair,
  pairId,
  onSelectPair,
}: {
  markets: PerpMarket[];
  pair: PerpMarket;
  pairId: string;
  onSelectPair: (id: string) => void;
}) {
  const dec = priceDecimals(pair.mark);
  const pinned = PERPS_PINNED_COINS.map((coin) => markets.find((m) => m.coin === coin)).filter(
    (m): m is PerpMarket => Boolean(m),
  );

  return (
    <div className="shrink-0 border-b border-border-subtle bg-bg-raised">
      {pinned.length > 0 ? (
        <div className="flex items-center gap-1 overflow-x-auto border-b border-border-subtle/80 px-2 py-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {pinned.map((p) => {
            const on = p.id === pairId;
            const d = priceDecimals(p.mark);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelectPair(p.id)}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-left transition-colors',
                  on ? 'bg-bg-hover text-fg-primary' : 'text-fg-secondary hover:bg-bg-hover/70',
                )}
              >
                <PerpIcon src={p.iconSrc} size={18} />
                <span className="text-[11px] font-semibold">{p.coin}</span>
                <span className="text-[11px] font-semibold tabular-nums">
                  {formatNumber(p.mark, { decimals: d })}
                </span>
                <span
                  className={cn(
                    'text-[10px] font-semibold tabular-nums',
                    p.chg24 >= 0 ? 'text-signal-bull' : 'text-signal-bear',
                  )}
                >
                  {p.chg24 >= 0 ? '+' : ''}
                  {p.chg24.toFixed(2)}%
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-2 py-1.5">
        <PerpMarketPicker markets={markets} selectedId={pairId} onSelect={onSelectPair} />
        <Stat label="Mark" value={formatNumber(pair.mark, { decimals: dec })} />
        <Stat label="Oracle" value={formatNumber(pair.oraclePx, { decimals: dec })} />
        <Stat
          label="24h"
          value={`${pair.chg24 >= 0 ? '+' : ''}${pair.chg24.toFixed(2)}%`}
          valueClass={pair.chg24 >= 0 ? 'text-signal-bull' : 'text-signal-bear'}
        />
        <Stat
          label="Funding"
          value={`${(pair.fundingHourly * 100).toFixed(4)}% / hr`}
          sub={`${pair.fundingApr >= 0 ? '+' : ''}${pair.fundingApr.toFixed(2)}% APR · ${pair.fundingCountdown}`}
        />
        <Stat label="Open interest" value={fmtPerpUsdCompact(pair.oiUsd)} />
        <Stat label="24h volume" value={fmtPerpUsdCompact(pair.vol24Usd)} />
        <Stat label="Max lev" value={`${pair.maxLeverage}x`} />
      </div>
    </div>
  );
}
