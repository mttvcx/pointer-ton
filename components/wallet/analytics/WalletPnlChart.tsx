'use client';

import { useEffect, useMemo, useRef } from 'react';
import {
  ColorType,
  createChart,
  CrosshairMode,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from 'lightweight-charts';
import type { WalletAnalyticsChartPoint } from '@/lib/wallet-analytics/types';
import { usdToNative } from '@/lib/wallet-analytics/displayCurrency';
import { PointerBirdMark } from '@/components/branding/PointerBirdMark';
import { cn } from '@/lib/utils/cn';

const BULL_HEX = '#3DDC97';
const BEAR_HEX = '#FF5E78';

export function WalletPnlChart({
  points,
  usdMode = true,
  solUsd = null,
  className,
}: {
  points: WalletAnalyticsChartPoint[];
  usdMode?: boolean;
  solUsd?: number | null;
  className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Baseline'> | null>(null);

  const displayPoints = useMemo(() => {
    if (usdMode) return points;
    return points.map((p) => {
      const native = usdToNative(p.v, solUsd);
      return { ...p, v: native ?? p.v };
    });
  }, [points, usdMode, solUsd]);

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

    const series = chart.addBaselineSeries({
      baseValue: { type: 'price', price: 0 },
      lineWidth: 2,
      lineStyle: LineStyle.Solid,
      /** Mirrors recharts gradient intent: denser tint near curve, fades toward y=0. */
      topFillColor1: 'rgba(61, 220, 151, 0.3)',
      topFillColor2: 'rgba(61, 220, 151, 0.05)',
      bottomFillColor1: 'rgba(255, 94, 120, 0.05)',
      bottomFillColor2: 'rgba(255, 94, 120, 0.3)',
      topLineColor: BULL_HEX,
      bottomLineColor: BULL_HEX,
      priceLineVisible: true,
      lastValueVisible: true,
      priceLineColor: 'rgba(61, 220, 151, 0.36)',
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

    series.createPriceLine({
      price: 0,
      color: 'rgba(255,255,255,0.08)',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: false,
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
    if (!series) return;
    if (displayPoints.length === 0) {
      series.setData([]);
      return;
    }
    const data = displayPoints.map((p) => ({
      time: Math.floor(p.t / 1000) as Time,
      value: p.v,
    }));
    series.setData(data);
    chartRef.current?.timeScale().fitContent();

    const last = displayPoints[displayPoints.length - 1]?.v ?? 0;
    const line =
      last > 0 ? BULL_HEX : last < 0 ? BEAR_HEX : 'rgba(155, 163, 176, 0.75)';
    const priceLineMuted =
      line === BULL_HEX
        ? 'rgba(61, 220, 151, 0.36)'
        : line === BEAR_HEX
          ? 'rgba(255, 94, 120, 0.36)'
          : 'rgba(155, 163, 176, 0.35)';
    series.applyOptions({
      topLineColor: line,
      bottomLineColor: line,
      priceLineColor: priceLineMuted,
    });
  }, [displayPoints]);

  return (
    <div className={cn('relative min-h-[174px] flex-1', className)}>
      <div ref={wrapRef} className="absolute inset-0" />
      {displayPoints.length === 0 ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <p className="text-center text-[11px] leading-snug text-fg-muted">
            No PnL history indexed for this wallet yet.
          </p>
        </div>
      ) : null}
      <div className="pointer-events-none absolute bottom-2 left-2.5 flex items-center gap-1.5">
        <PointerBirdMark size={16} className="opacity-45" />
        <span className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-fg-muted/45">
          POINTER
        </span>
      </div>
    </div>
  );
}
