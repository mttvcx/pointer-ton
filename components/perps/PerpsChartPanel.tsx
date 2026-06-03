'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { PerpMarket } from '@/lib/perps/types';
import { cn } from '@/lib/utils/cn';
import { formatNumber } from '@/lib/utils/formatters';

const TIMEFRAMES = ['1m', '5m', '15m', '1H', '4H', '1D'] as const;

type TradingViewWidgetOptions = {
  autosize: boolean;
  symbol: string;
  interval: string;
  timezone: string;
  theme: 'dark';
  style: string;
  locale: string;
  backgroundColor: string;
  gridColor: string;
  hide_top_toolbar: boolean;
  hide_legend: boolean;
  save_image: boolean;
  allow_symbol_change: boolean;
  calendar: boolean;
  support_host: string;
  container_id: string;
};

type TradingViewGlobal = {
  widget: new (options: TradingViewWidgetOptions) => { remove?: () => void };
};

declare global {
  interface Window {
    TradingView?: TradingViewGlobal;
  }
}

function priceDecimals(mark: number): number {
  if (mark >= 5000) return 0;
  if (mark >= 500) return 1;
  return 2;
}

export function PerpsChartPanel({
  pair,
  tf,
  onTfChange,
}: {
  pair: PerpMarket;
  tf: (typeof TIMEFRAMES)[number];
  onTfChange: (t: (typeof TIMEFRAMES)[number]) => void;
}) {
  const containerId = useMemo(() => `tradingview-perps-${pair.id}`, [pair.id]);
  const widgetRef = useRef<{ remove?: () => void } | null>(null);
  const [widgetLoaded, setWidgetLoaded] = useState(false);
  const dec = priceDecimals(pair.mark);
  const interval = tf === '1H' ? '60' : tf === '4H' ? '240' : tf === '1D' ? 'D' : tf.replace('m', '');

  useEffect(() => {
    let cancelled = false;

    const createWidget = () => {
      if (cancelled || !window.TradingView) return;
      widgetRef.current?.remove?.();
      widgetRef.current = new window.TradingView.widget({
        autosize: true,
        symbol: pair.tvSymbol,
        interval,
        timezone: 'Etc/UTC',
        theme: 'dark',
        style: '1',
        locale: 'en',
        backgroundColor: 'rgb(var(--bg-base-rgb))',
        gridColor: 'rgba(255,255,255,0.055)',
        hide_top_toolbar: false,
        hide_legend: false,
        save_image: false,
        allow_symbol_change: false,
        calendar: false,
        support_host: 'https://www.tradingview.com',
        container_id: containerId,
      });
      setWidgetLoaded(true);
    };

    setWidgetLoaded(false);
    if (window.TradingView) {
      createWidget();
    } else {
      const existing = document.getElementById('tradingview-widget-script');
      if (existing) {
        existing.addEventListener('load', createWidget, { once: true });
      } else {
        const script = document.createElement('script');
        script.id = 'tradingview-widget-script';
        script.src = 'https://s3.tradingview.com/tv.js';
        script.async = true;
        script.addEventListener('load', createWidget, { once: true });
        document.head.appendChild(script);
      }
    }

    return () => {
      cancelled = true;
      widgetRef.current?.remove?.();
      widgetRef.current = null;
    };
  }, [containerId, interval, pair.tvSymbol]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-bg-base">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle bg-bg-raised px-2 py-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[12px] font-semibold text-fg-primary">{pair.label}</span>
          <span className="rounded bg-bg-hover px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-fg-secondary">
            {formatNumber(pair.mark, { decimals: dec })}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-0.5">
          {TIMEFRAMES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onTfChange(t)}
              className={cn(
                'rounded px-2 py-0.5 text-[10px] font-semibold tabular-nums transition-colors',
                tf === t
                  ? 'bg-accent-primary/20 text-accent-glow ring-1 ring-accent-primary/30'
                  : 'text-fg-muted hover:bg-bg-hover hover:text-fg-secondary',
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="relative min-h-[280px] flex-1 bg-bg-base lg:min-h-0">
        <div className="absolute inset-0" id={containerId} />
        <div
          className={cn(
            'pointer-events-none absolute inset-0 flex items-center justify-center bg-bg-base text-[11px] text-fg-muted transition-opacity',
            widgetLoaded ? 'opacity-0' : 'opacity-100',
          )}
        >
          Loading chart…
        </div>
      </div>
    </div>
  );
}

export { TIMEFRAMES };
