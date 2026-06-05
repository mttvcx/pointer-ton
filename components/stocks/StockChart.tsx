'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createChart,
  ColorType,
  CrosshairMode,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from 'lightweight-charts';
import { Camera, ChevronDown, Maximize2, Redo2, Settings2, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { getSyntheticStockProvider } from '@/lib/stocks/providers';
import type { SyntheticStockCandle, SyntheticStockMarket } from '@/lib/stocks/types';
import { cssRgbFromVar } from '@/lib/theme/cssSurfaceColors';
import { formatPercent, formatPriceUsd } from '@/lib/utils/formatters';
import { cn } from '@/lib/utils/cn';

const INTERVALS = ['1m', '5m', '15m', '1h', '1d'] as const;
type StockInterval = (typeof INTERVALS)[number];
type ScaleExtra = 'normal' | 'log' | 'percent';

export function StockChart({
  symbol,
  market,
  edgeToEdge,
  className,
}: {
  symbol: string;
  market: SyntheticStockMarket;
  edgeToEdge?: boolean;
  className?: string;
}) {
  const tick = symbol.replace(/^\$+/, '');
  const [interval, setInterval] = useState<StockInterval>('15m');
  const [candles, setCandles] = useState<SyntheticStockCandle[]>([]);
  const [loading, setLoading] = useState(true);
  const [scaleExtra, setScaleExtra] = useState<ScaleExtra>('normal');
  const [displayOpen, setDisplayOpen] = useState(false);

  const outerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const provider = getSyntheticStockProvider();
    void provider.getCandles(symbol, interval).then((rows) => {
      if (cancelled) return;
      setCandles(rows);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [symbol, interval]);

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

  const lastOhlc = useMemo(() => {
    if (candles.length === 0) return null;
    const last = candles[candles.length - 1]!;
    const prev = candles.length > 1 ? candles[candles.length - 2]! : last;
    const ch = last.close - prev.close;
    const pct = prev.close !== 0 ? (ch / prev.close) * 100 : 0;
    return { o: last.open, h: last.high, l: last.low, c: last.close, ch, pct };
  }, [candles]);

  const pairTitle = `${tick}/USD on Pointer · ${interval}`;

  const onFullscreen = () => {
    const el = outerRef.current;
    if (!el?.requestFullscreen) {
      toast.message('Fullscreen', { description: 'Not supported in this browser.' });
      return;
    }
    void el.requestFullscreen().catch(() => {
      toast.error('Could not enter fullscreen');
    });
  };

  const fmtPx = (n: number) => formatPriceUsd(n);

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
              onClick={() => setInterval(iv)}
              className={cn(
                'btn-press px-2 py-1 tabular-nums text-[11px] font-semibold transition-colors',
                interval === iv ? 'text-signal-bull' : 'text-fg-muted hover:text-fg-secondary',
              )}
            >
              {iv}
            </button>
          ))}
        </div>
        <span className="hidden h-4 w-px bg-border-subtle md:inline-block" aria-hidden />
        <button
          type="button"
          className="btn-press rounded px-2 py-1 text-[11px] font-medium text-fg-secondary hover:text-fg-primary"
          onClick={() => toast.message('Indicators', { description: 'Study library is planned for equities.' })}
        >
          Indicators
        </button>
        <div className="relative">
          <button
            type="button"
            className="btn-press inline-flex items-center gap-0.5 rounded px-2 py-1 text-[11px] font-medium text-fg-secondary hover:text-fg-primary"
            onClick={() => setDisplayOpen((o) => !o)}
          >
            Display Options
            <ChevronDown className="h-3 w-3 opacity-80" />
          </button>
          {displayOpen ? (
            <div className="absolute left-0 top-full z-[50] mt-0.5 min-w-[11rem] rounded-md border border-border-subtle bg-bg-raised py-1 shadow-xl">
              <button
                type="button"
                className="w-full px-3 py-1.5 text-left text-[11px] text-fg-secondary hover:bg-bg-hover hover:text-fg-primary"
                onClick={() => toast.message('Funding markers', { description: 'Coming soon.' })}
              >
                Funding markers
              </button>
              <button
                type="button"
                className="w-full px-3 py-1.5 text-left text-[11px] text-fg-secondary hover:bg-bg-hover hover:text-fg-primary"
                onClick={() => toast.message('OI overlay', { description: 'Coming soon.' })}
              >
                Open interest
              </button>
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            className="btn-press rounded p-1 text-fg-muted hover:text-fg-secondary"
            title="Undo zoom"
            onClick={() => toast.message('Undo', { description: 'Connect chart undo stack later.' })}
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="btn-press rounded p-1 text-fg-muted hover:text-fg-secondary"
            title="Redo"
            onClick={() => toast.message('Redo', { description: 'Connect redo stack later.' })}
          >
            <Redo2 className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="ml-auto flex items-center gap-0.5">
          <select
            aria-label="Chart data provider"
            className="h-7 max-w-[7rem] cursor-pointer rounded border border-border-subtle bg-bg-base px-1.5 text-[10px] text-fg-secondary"
            disabled
          >
            <option>Pointer</option>
          </select>
          <button
            type="button"
            className="btn-press rounded p-1 text-fg-muted hover:text-fg-secondary"
            title="Chart settings"
            onClick={() => toast.message('Chart settings', { description: 'Equity chart settings coming soon.' })}
          >
            <Settings2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="btn-press rounded p-1 text-fg-muted hover:text-fg-secondary"
            title="Fullscreen chart"
            onClick={() => void onFullscreen()}
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="btn-press rounded p-1 text-fg-muted hover:text-fg-secondary"
            title="Snapshot"
            onClick={() => toast.message('Snapshot', { description: 'Use your OS screenshot tools for now.' })}
          >
            <Camera className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="border-b border-border-subtle px-2 py-0.5">
        <div className="text-[11px] leading-tight text-fg-secondary">
          <span className="font-medium text-fg-primary">{pairTitle}</span>
        </div>
        <div
          className={cn(
            'mt-0.5 tabular-nums text-[11px] font-semibold',
            lastOhlc != null && lastOhlc.ch < 0 ? 'text-signal-bear' : 'text-signal-bull',
          )}
        >
          {lastOhlc ? (
            <>
              O {fmtPx(lastOhlc.o)} H {fmtPx(lastOhlc.h)} L {fmtPx(lastOhlc.l)} C {fmtPx(lastOhlc.c)}{' '}
              {lastOhlc.ch >= 0 ? '+' : ''}
              {fmtPx(lastOhlc.ch)} ({formatPercent(lastOhlc.pct, { decimals: 2 })})
            </>
          ) : (
            <span className="text-fg-muted">
              O {fmtPx(market.priceUsd)} H {fmtPx(market.priceUsd)} L {fmtPx(market.priceUsd)} C{' '}
              {fmtPx(market.priceUsd)}{' '}
              {market.change24hPct >= 0 ? '+' : ''}
              {formatPercent(market.change24hPct, { decimals: 2 })}
            </span>
          )}
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        <div ref={containerRef} className="absolute inset-0 h-full min-h-0 w-full" />
        {loading ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-bg-raised text-[12px] text-fg-muted">
            Loading{'\u2026'}
          </div>
        ) : null}
        {!loading && candles.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center bg-bg-raised text-[12px] text-fg-muted">
            No price history yet.
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-border-subtle px-2 py-0.5 tabular-nums text-[10px]">
        <button
          type="button"
          onClick={() => setScaleExtra('percent')}
          className={cn(
            'btn-press rounded px-1.5 py-0.5 uppercase',
            scaleExtra === 'percent' ? 'text-signal-bull' : 'text-fg-muted hover:text-fg-secondary',
          )}
          title="Percentage scale"
        >
          %
        </button>
        <button
          type="button"
          onClick={() => setScaleExtra('log')}
          className={cn(
            'btn-press rounded px-1.5 py-0.5 uppercase',
            scaleExtra === 'log' ? 'text-signal-bull' : 'text-fg-muted hover:text-fg-secondary',
          )}
          title="Logarithmic scale"
        >
          log
        </button>
        <button
          type="button"
          onClick={() => setScaleExtra('normal')}
          className={cn(
            'btn-press rounded px-1.5 py-0.5 uppercase',
            scaleExtra === 'normal' ? 'text-signal-bull' : 'text-fg-muted hover:text-fg-secondary',
          )}
          title="Auto / linear"
        >
          auto
        </button>
      </div>
    </div>
  );
}
