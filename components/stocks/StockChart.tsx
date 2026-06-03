'use client';

import { useEffect, useRef } from 'react';
import {
  createChart,
  ColorType,
  CrosshairMode,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from 'lightweight-charts';
import type { SyntheticStockCandle } from '@/lib/stocks/types';
import { cssRgbFromVar } from '@/lib/theme/cssSurfaceColors';
import { cn } from '@/lib/utils/cn';

const INTERVALS = ['1m', '5m', '15m', '1h', '1d'] as const;

export function StockChart({
  candles,
  symbol,
  edgeToEdge,
  className,
}: {
  candles: SyntheticStockCandle[];
  symbol: string;
  edgeToEdge?: boolean;
  className?: string;
}) {
  const outerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chartBg = cssRgbFromVar('--bg-raised-rgb', 'rgb(18, 18, 20)');
    const gridColor = cssRgbFromVar('--border-subtle-rgb', 'rgb(28, 28, 32)');
    const bull = cssRgbFromVar('--signal-bull-rgb', 'rgb(61, 220, 151)');
    const bear = cssRgbFromVar('--signal-bear-rgb', 'rgb(251, 113, 133)');

    const chart = createChart(el, {
      width: el.clientWidth,
      height: el.clientHeight,
      layout: {
        background: { type: ColorType.Solid, color: chartBg },
        textColor: cssRgbFromVar('--fg-muted-rgb', 'rgb(140, 145, 155)'),
      },
      grid: {
        vertLines: { color: gridColor },
        horzLines: { color: gridColor },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
    });

    const series = chart.addCandlestickSeries({
      upColor: bull,
      downColor: bear,
      wickUpColor: bull,
      wickDownColor: bear,
      borderVisible: false,
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const ro = new ResizeObserver(() => {
      chart.applyOptions({ width: el.clientWidth, height: el.clientHeight });
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series || candles.length === 0) return;
    const data: CandlestickData<Time>[] = candles.map((c) => ({
      time: Math.floor(c.time / 1000) as Time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    series.setData(data);
    chartRef.current?.timeScale().fitContent();
  }, [candles, symbol]);

  return (
    <div
      ref={outerRef}
      className={cn(
        'flex h-full min-h-0 flex-1 flex-col border border-border-subtle bg-transparent',
        edgeToEdge ? 'rounded-none border-x-0 border-t-0' : 'rounded-sm',
        className,
      )}
    >
      <div className="flex min-h-[2rem] flex-wrap items-center gap-x-1 gap-y-0.5 border-b border-border-subtle px-1 py-0.5 text-[11px]">
        <div className="flex flex-wrap items-center gap-0">
          {INTERVALS.map((iv) => (
            <button
              key={iv}
              type="button"
              className={cn(
                'rounded px-1.5 py-0.5 font-semibold tabular-nums transition-colors',
                iv === '15m'
                  ? 'bg-bg-hover text-fg-primary'
                  : 'text-fg-muted hover:text-fg-secondary',
              )}
            >
              {iv}
            </button>
          ))}
        </div>
        <span className="ml-auto truncate pr-1 text-[10px] font-medium text-fg-muted">
          {symbol}/USD
        </span>
      </div>
      <div ref={containerRef} className="min-h-0 flex-1" />
    </div>
  );
}
