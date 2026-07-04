'use client';

import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  createChart,
  ColorType,
  CrosshairMode,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts';
import type { PerpCandle } from '@/lib/hyperliquid/candles';

/**
 * Seamless in-page perps chart — Hyperliquid candles rendered with
 * lightweight-charts (same engine as the spot TokenChart), replacing the old
 * embedded TradingView widget (an iframe pointed at a Binance symbol that hung
 * on load and never showed our venue's data). Polls for live updates.
 *
 * This is the pragmatic path to Axiom/Cashed-level seamlessness without the
 * licensed TradingView Charting Library; that (drawing tools, indicator panel)
 * is a later upgrade — see the note in the PR.
 */
export function PerpsLightweightChart({ coin, tf }: { coin: string; tf: string }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

  const q = useQuery({
    queryKey: ['perp-candles', coin, tf],
    queryFn: async (): Promise<PerpCandle[]> => {
      const res = await fetch(`/api/perps/candles?coin=${encodeURIComponent(coin)}&tf=${encodeURIComponent(tf)}`);
      if (!res.ok) throw new Error(`candles_${res.status}`);
      const json = (await res.json()) as { candles?: PerpCandle[] };
      return json.candles ?? [];
    },
    enabled: Boolean(coin),
    refetchInterval: 6000,
    staleTime: 4000,
  });

  // Create the chart once.
  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#9ba3b0',
        fontFamily: 'inherit',
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.045)' },
        horzLines: { color: 'rgba(255,255,255,0.045)' },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.08)' },
      timeScale: { borderColor: 'rgba(255,255,255,0.08)', timeVisible: true, secondsVisible: false },
    });
    const series = chart.addCandlestickSeries({
      upColor: '#3ddc97',
      downColor: '#ff5e78',
      wickUpColor: '#3ddc97',
      wickDownColor: '#ff5e78',
      borderVisible: false,
    });
    chartRef.current = chart;
    seriesRef.current = series;
    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // Push data whenever it changes.
  useEffect(() => {
    const series = seriesRef.current;
    if (!series || !q.data) return;
    const data: CandlestickData[] = q.data.map((c) => ({
      time: c.time as UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    series.setData(data);
    chartRef.current?.timeScale().fitContent();
  }, [q.data]);

  const empty = !q.isLoading && (q.data?.length ?? 0) === 0;

  return (
    <div className="relative h-full w-full">
      <div ref={hostRef} className="absolute inset-0" />
      {q.isLoading ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-[11px] text-fg-muted">
          Loading chart…
        </div>
      ) : empty ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-[11px] text-fg-muted">
          Chart data unavailable for {coin}.
        </div>
      ) : null}
    </div>
  );
}
