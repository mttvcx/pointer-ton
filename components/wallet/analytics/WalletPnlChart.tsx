'use client';

import { useEffect, useRef } from 'react';
import {
  ColorType,
  createChart,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from 'lightweight-charts';
import type { WalletAnalyticsChartPoint } from '@/lib/wallet-analytics/types';
import { cn } from '@/lib/utils/cn';

export function WalletPnlChart({
  points,
  className,
}: {
  points: WalletAnalyticsChartPoint[];
  className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const chart = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: 'rgba(117,128,146,0.58)',
        fontSize: 9,
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.018)' },
        horzLines: { color: 'rgba(255,255,255,0.025)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: 'rgba(255,255,255,0.1)', labelVisible: false, width: 1 },
        horzLine: { color: 'rgba(255,255,255,0.06)', labelVisible: false, width: 1 },
      },
      rightPriceScale: {
        borderColor: 'rgba(255,255,255,0.06)',
        scaleMargins: { top: 0.12, bottom: 0.16 },
      },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.06)',
        timeVisible: false,
        secondsVisible: false,
      },
      handleScale: false,
      handleScroll: false,
    });

    const series = chart.addAreaSeries({
      lineColor: 'rgba(45,212,191,0.72)',
      topColor: 'rgba(45,212,191,0.08)',
      bottomColor: 'rgba(45,212,191,0.005)',
      lineWidth: 2,
      priceLineVisible: true,
      lastValueVisible: true,
      priceLineColor: 'rgba(45,212,191,0.36)',
      priceLineWidth: 1,
      priceFormat: {
        type: 'price',
        precision: 0,
        minMove: 1,
      },
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 2,
      lastPriceAnimation: 0,
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const ro = new ResizeObserver(() => {
      chart.applyOptions({
        width: el.clientWidth,
        height: el.clientHeight,
      });
    });
    ro.observe(el);
    chart.applyOptions({ width: el.clientWidth, height: el.clientHeight });

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series || points.length === 0) return;
    const data = points.map((p) => ({
      time: (Math.floor(p.t / 1000)) as Time,
      value: p.v,
    }));
    series.setData(data);
    chartRef.current?.timeScale().fitContent();
  }, [points]);

  return (
    <div className={cn('relative min-h-[174px] flex-1', className)}>
      <div ref={wrapRef} className="absolute inset-0" />
      <div className="pointer-events-none absolute bottom-1.5 left-2 flex items-center gap-1.5 opacity-18">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/branding/logo-bird.svg" alt="" width={18} height={18} />
        <span className="text-[9px] font-semibold uppercase tracking-wider text-fg-muted">pointer.</span>
      </div>
    </div>
  );
}
