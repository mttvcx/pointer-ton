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
        textColor: 'rgba(148,163,184,0.85)',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.04)' },
        horzLines: { color: 'rgba(255,255,255,0.04)' },
      },
      crosshair: { mode: CrosshairMode.Hidden },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
    });

    const series = chart.addAreaSeries({
      lineColor: '#2dd4bf',
      topColor: 'rgba(45,212,191,0.35)',
      bottomColor: 'rgba(45,212,191,0.02)',
      lineWidth: 2,
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
    <div className={cn('relative min-h-[200px] flex-1', className)}>
      <div ref={wrapRef} className="absolute inset-0" />
      <div className="pointer-events-none absolute bottom-2 left-2 flex items-center gap-1.5 opacity-40">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/branding/logo-bird.svg" alt="" width={18} height={18} />
        <span className="text-[9px] font-semibold uppercase tracking-wider text-fg-muted">pointer.</span>
      </div>
    </div>
  );
}
