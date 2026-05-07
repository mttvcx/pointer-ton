'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { useQuery } from '@tanstack/react-query';
import {
  createChart,
  ColorType,
  CrosshairMode,
  LineStyle,
  PriceScaleMode,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type SeriesMarker,
  type Time,
} from 'lightweight-charts';
import {
  Camera,
  ChevronDown,
  Maximize2,
  Redo2,
  Settings2,
  Undo2,
} from 'lucide-react';
import { toast } from 'sonner';
import type { ChartInterval } from '@/lib/helius/chart';
import { formatCompactUsd, formatNumber, formatPercent } from '@/lib/utils/formatters';
import { cn } from '@/lib/utils/cn';
import {
  readChartOverlays,
  persistChartOverlays,
  type ChartOverlayFlags,
} from '@/lib/chart/tokenChartOverlays';

const OVERLAYS_EVT = 'pointer-chart-overlays';

const INTERVALS: ChartInterval[] = ['1s', '3m', '1m', '5m', '15m', '1h', '1d', '5d'];

type ChartResponse = {
  mint: string;
  interval: ChartInterval;
  bars: { time: number; open: number; high: number; low: number; close: number }[];
};

type WalletMarkersResponse = {
  markers: {
    time: number;
    side: 'buy' | 'sell';
    walletAddress: string;
    trackerLabel: string | null;
    txSignature: string;
  }[];
};

type AxisMode = 'price' | 'mc';
type QuoteMode = 'usd' | 'sol';
type ScaleExtra = 'normal' | 'log' | 'percent';

function applyBarTransform(
  v: number,
  quote: QuoteMode,
  solUsd: number | null,
  showMc: boolean,
  supply: number | null,
) {
  let x = v;
  if (showMc && supply != null && supply > 0) x *= supply;
  if (quote === 'sol' && solUsd != null && solUsd > 0) x /= solUsd;
  return x;
}

function mapBar(
  b: ChartResponse['bars'][0],
  quote: QuoteMode,
  solUsd: number | null,
  showMc: boolean,
  supply: number | null,
): CandlestickData {
  return {
    time: b.time as Time,
    open: applyBarTransform(b.open, quote, solUsd, showMc, supply),
    high: applyBarTransform(b.high, quote, solUsd, showMc, supply),
    low: applyBarTransform(b.low, quote, solUsd, showMc, supply),
    close: applyBarTransform(b.close, quote, solUsd, showMc, supply),
  };
}

export function TokenChart({
  mint,
  symbol,
  supplyTokens,
  edgeToEdge,
}: {
  mint: string;
  symbol: string | null;
  supplyTokens?: number | null;
  edgeToEdge?: boolean;
}) {
  const tick = (symbol ?? '???').replace(/^\$+/, '');
  const [interval, setInterval] = useState<ChartInterval>('5m');
  const [quoteMode, setQuoteMode] = useState<QuoteMode>('usd');
  const [axisMode, setAxisMode] = useState<AxisMode>('price');
  const [scaleExtra, setScaleExtra] = useState<ScaleExtra>('normal');
  const [hideAllBubbles, setHideAllBubbles] = useState(false);
  const [displayOpen, setDisplayOpen] = useState(false);
  const [overlays, setOverlays] = useState<ChartOverlayFlags>(() => readChartOverlays());
  useEffect(() => {
    const sync = () => setOverlays(readChartOverlays());
    window.addEventListener(OVERLAYS_EVT, sync);
    return () => window.removeEventListener(OVERLAYS_EVT, sync);
  }, []);
  const outerRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const { authenticated, getAccessToken } = usePointerAuth();

  const solUsdQ = useQuery({
    queryKey: ['sol-usd-spot'],
    queryFn: async () => {
      const r = await fetch('/api/prices/tickers');
      const j = (await r.json()) as { tickers?: { symbol: string; usdPrice: number | null }[] };
      const hit = j.tickers?.find((t) => t.symbol === 'SOL');
      return hit?.usdPrice ?? null;
    },
    staleTime: 60_000,
  });
  const solUsd = solUsdQ.data ?? null;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['token-chart', mint, interval],
    queryFn: async (): Promise<ChartResponse> => {
      const r = await fetch(`/api/tokens/${encodeURIComponent(mint)}/chart?interval=${interval}`);
      if (!r.ok) throw new Error('chart_request_failed');
      return r.json() as Promise<ChartResponse>;
    },
  });

  const { data: markersRes } = useQuery({
    queryKey: ['token-wallet-markers', mint],
    enabled: authenticated,
    staleTime: 30_000,
    queryFn: async (): Promise<WalletMarkersResponse> => {
      const token = await getAccessToken();
      if (!token) return { markers: [] };
      const r = await fetch(`/api/tokens/${encodeURIComponent(mint)}/wallet-markers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.status === 401 || r.status === 403) return { markers: [] };
      if (!r.ok) return { markers: [] };
      return r.json() as Promise<WalletMarkersResponse>;
    },
  });

  const showMc = axisMode === 'mc';
  const supply = supplyTokens ?? null;

  const lastOhlc = useMemo(() => {
    const bars = data?.bars;
    if (!bars?.length) return null;
    const b = bars[bars.length - 1]!;
    const o = applyBarTransform(b.open, quoteMode, solUsd, showMc, supply);
    const h = applyBarTransform(b.high, quoteMode, solUsd, showMc, supply);
    const l = applyBarTransform(b.low, quoteMode, solUsd, showMc, supply);
    const c = applyBarTransform(b.close, quoteMode, solUsd, showMc, supply);
    const ch = c - o;
    const pct = o !== 0 ? (ch / o) * 100 : 0;
    return { o, h, l, c, ch, pct };
  }, [data?.bars, quoteMode, solUsd, showMc, supply]);

  const fmtPx = useCallback(
    (v: number) => {
      if (quoteMode === 'sol') return `${formatNumber(v, { decimals: 5 })} SOL`;
      if (showMc) return formatCompactUsd(v);
      return formatCompactUsd(v);
    },
    [quoteMode, showMc],
  );

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const chart = createChart(el, {
      width: el.clientWidth,
      height: Math.max(1, el.clientHeight),
      layout: {
        background: { type: ColorType.Solid, color: '#0b0d12' },
        textColor: '#8b92a4',
        fontSize: 12,
      },
      grid: {
        vertLines: { color: '#1b1f2a' },
        horzLines: { color: '#1b1f2a' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: '#2e3548',
          width: 1,
          style: LineStyle.Solid,
          labelBackgroundColor: '#3d4458',
        },
        horzLine: {
          color: '#2e3548',
          width: 1,
          style: LineStyle.Solid,
          labelBackgroundColor: '#3d4458',
        },
      },
      rightPriceScale: {
        borderColor: '#1b1f2a',
        scaleMargins: { top: 0.08, bottom: 0.12 },
      },
      timeScale: {
        borderColor: '#1b1f2a',
        fixLeftEdge: true,
        fixRightEdge: false,
      },
      leftPriceScale: { visible: false },
    });

    const series = chart.addCandlestickSeries({
      upColor: '#34d399',
      downColor: '#fb7185',
      borderVisible: false,
      wickUpColor: '#34d399',
      wickDownColor: '#fb7185',
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const resizeChart = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w > 0 && h > 0) chart.resize(w, h);
    };
    requestAnimationFrame(() => requestAnimationFrame(resizeChart));
    const ro = new ResizeObserver(() => resizeChart());
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [mint]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const mode =
      scaleExtra === 'log'
        ? PriceScaleMode.Logarithmic
        : scaleExtra === 'percent'
          ? PriceScaleMode.Percentage
          : PriceScaleMode.Normal;
    chart.priceScale('right').applyOptions({
      mode,
      borderColor: '#1b1f2a',
    });
  }, [scaleExtra]);

  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart || !data?.bars) return;

    const candle: CandlestickData[] = data.bars.map((b) =>
      mapBar(b, quoteMode, solUsd, showMc, supply),
    );
    series.setData(candle);

    const showMarkers = authenticated && !hideAllBubbles && overlays.alertBubbles;
    const rawMarkers = showMarkers ? (markersRes?.markers ?? []) : [];
    const markers: SeriesMarker<Time>[] = rawMarkers.map((m) => ({
        time: m.time as Time,
        position: m.side === 'buy' ? 'belowBar' : 'aboveBar',
        shape: m.side === 'buy' ? 'arrowUp' : 'arrowDown',
        color: m.side === 'buy' ? '#34d399' : '#fb7185',
        text: m.trackerLabel ? m.trackerLabel.slice(0, 28) : undefined,
        id: m.txSignature,
      }));
    series.setMarkers(markers);

    chart.timeScale().fitContent();
  }, [data, markersRes, authenticated, quoteMode, solUsd, showMc, supply, hideAllBubbles, overlays]);

  const patchOverlays = (patch: Partial<ChartOverlayFlags>) => {
    setOverlays((prev) => {
      const next = { ...prev, ...patch };
      persistChartOverlays(next);
      return next;
    });
  };

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

  const pairTitle = `${tick}${quoteMode === 'usd' ? '/USD' : '/SOL'} on Pointer · ${interval}`;

  return (
    <div
      ref={outerRef}
      className={cn(
        'flex h-full min-h-0 flex-1 flex-col border border-[#1b1f2a] bg-[#0b0d12]',
        edgeToEdge ? 'rounded-none border-x-0 border-t-0' : 'rounded-sm',
      )}
    >
      {/* Chart toolbar */}
      <div className="flex min-h-[2rem] flex-wrap items-center gap-x-1 gap-y-0.5 border-b border-[#1b1f2a] px-1 py-0.5 text-[11px]">
        <div className="flex flex-wrap items-center gap-0">
          {INTERVALS.map((iv) => (
            <button
              key={iv}
              type="button"
              onClick={() => setInterval(iv)}
              className={cn(
                'btn-press px-2 py-1 tabular-nums text-[11px] font-semibold tabular-nums transition-colors',
                interval === iv
                  ? 'text-[#5eead4]'
                  : 'text-[#6b7280] hover:text-fg-secondary',
              )}
            >
              {iv}
            </button>
          ))}
        </div>
        <span className="hidden h-4 w-px bg-[#1b1f2a] md:inline-block" aria-hidden />
        <button
          type="button"
          className="btn-press rounded px-2 py-1 text-[11px] font-medium text-[#9ca3af] hover:text-fg-secondary"
          onClick={() => toast.message('Indicators', { description: 'Study library (RSI, VWAP, etc.) is planned.' })}
        >
          Indicators
        </button>
        <div className="relative">
          <button
            type="button"
            className="btn-press inline-flex items-center gap-0.5 rounded px-2 py-1 text-[11px] font-medium text-[#9ca3af] hover:text-fg-secondary"
            onClick={() => setDisplayOpen((o) => !o)}
          >
            Display Options
            <ChevronDown className="h-3 w-3 opacity-80" />
          </button>
          {displayOpen ? (
            <div className="absolute left-0 top-full z-[50] mt-0.5 min-w-[11rem] rounded-md border border-[#1b1f2a] bg-[#12151c] py-1 shadow-xl">
              <DisplayToggleRow
                label="Dev trades"
                on={overlays.devTrades}
                onClick={() => patchOverlays({ devTrades: !overlays.devTrades })}
              />
              <DisplayToggleRow
                label="Tracked only"
                on={overlays.trackedOnly}
                onClick={() => patchOverlays({ trackedOnly: !overlays.trackedOnly })}
              />
              <DisplayToggleRow
                label="Alert bubbles"
                on={overlays.alertBubbles}
                onClick={() => patchOverlays({ alertBubbles: !overlays.alertBubbles })}
              />
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setHideAllBubbles((h) => !h)}
          className={cn(
            'btn-press rounded px-2 py-1 text-[11px] font-medium',
            hideAllBubbles ? 'text-[#5eead4]' : 'text-[#9ca3af] hover:text-fg-secondary',
          )}
        >
          {hideAllBubbles ? 'Show bubbles' : 'Hide All Bubbles'}
        </button>
        <span className="hidden h-4 w-px bg-[#1b1f2a] lg:inline-block" aria-hidden />
        <button
          type="button"
          onClick={() => setQuoteMode((q) => (q === 'usd' ? 'sol' : 'usd'))}
          className="btn-press rounded px-2 py-1 tabular-nums text-[11px] font-semibold"
        >
          <span className={quoteMode === 'usd' ? 'text-[#5eead4]' : 'text-[#6b7280]'}>USD</span>
          <span className="mx-0.5 text-[#374151]">/</span>
          <span className={quoteMode === 'sol' ? 'text-[#5eead4]' : 'text-[#6b7280]'}>SOL</span>
        </button>
        <button
          type="button"
          onClick={() => setAxisMode((a) => (a === 'price' ? 'mc' : 'price'))}
          className="btn-press rounded px-2 py-1 tabular-nums text-[11px] font-semibold"
        >
          <span className={axisMode === 'mc' ? 'text-[#5eead4]' : 'text-[#6b7280]'}>MC</span>
          <span className="mx-0.5 text-[#374151]">/</span>
          <span className={axisMode === 'price' ? 'text-[#5eead4]' : 'text-[#6b7280]'}>Px</span>
        </button>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            className="btn-press rounded p-1 text-[#6b7280] hover:text-fg-secondary"
            title="Undo zoom"
            onClick={() => toast.message('Undo', { description: 'Connect TradingView undo stack later.' })}
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="btn-press rounded p-1 text-[#6b7280] hover:text-fg-secondary"
            title="Redo"
            onClick={() => toast.message('Redo', { description: 'Connect redo stack later.' })}
          >
            <Redo2 className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="ml-auto flex items-center gap-0.5">
          <select
            aria-label="Chart data provider"
            className="h-7 max-w-[7rem] cursor-pointer rounded border border-[#1b1f2a] bg-[#0b0d12] px-1.5 text-[10px] text-fg-secondary"
            disabled
          >
            <option>Pointer</option>
          </select>
          <button
            type="button"
            className="btn-press rounded p-1 text-[#6b7280] hover:text-fg-secondary"
            title="Chart settings"
            onClick={() =>
              document.querySelector<HTMLElement>('[data-mint="' + mint + '"]')?.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
              })
            }
          >
            <Settings2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="btn-press rounded p-1 text-[#6b7280] hover:text-fg-secondary"
            title="Fullscreen chart"
            onClick={() => void onFullscreen()}
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="btn-press rounded p-1 text-[#6b7280] hover:text-fg-secondary"
            title="Snapshot"
            onClick={() =>
              toast.message('Snapshot', { description: 'Use your OS screenshot tools for now.' })
            }
          >
            <Camera className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* OHLC strip */}
      <div className="border-b border-[#1b1f2a] px-2 py-0.5">
        <div className="text-[11px] leading-tight text-[#9ca3af]">
          <span className="font-medium text-[#d1d5db]">{pairTitle}</span>
        </div>
        <div
          className={cn(
            'mt-0.5 tabular-nums text-[11px] font-semibold tabular-nums',
            lastOhlc != null && lastOhlc.ch < 0 ? 'text-[#fb7185]' : 'text-[#34d399]',
          )}
        >
          {lastOhlc ? (
            <>
              O {fmtPx(lastOhlc.o)} H {fmtPx(lastOhlc.h)} L {fmtPx(lastOhlc.l)} C {fmtPx(lastOhlc.c)}{' '}
              {lastOhlc.ch >= 0 ? '+' : ''}
              {fmtPx(lastOhlc.ch)} ({formatPercent(lastOhlc.pct, { decimals: 2 })})
            </>
          ) : (
            <span className="text-[#6b7280]">No OHLC yet</span>
          )}
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        <div ref={wrapRef} className="absolute inset-0 h-full min-h-0 w-full" />
        {isLoading ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#0b0d12] text-[12px] text-[#6b7280]">
            Loading{'\u2026'}
          </div>
        ) : null}
        {isError ? (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0b0d12] text-[12px] text-[#fb7185]">
            Could not load price history.
          </div>
        ) : null}
      </div>

      {/* Bottom chart controls */}
      <div className="flex items-center justify-end gap-2 border-t border-[#1b1f2a] px-2 py-0.5 tabular-nums text-[10px]">
        <button
          type="button"
          onClick={() => setScaleExtra('percent')}
          className={cn(
            'btn-press rounded px-1.5 py-0.5 uppercase',
            scaleExtra === 'percent' ? 'text-[#5eead4]' : 'text-[#6b7280] hover:text-fg-secondary',
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
            scaleExtra === 'log' ? 'text-[#5eead4]' : 'text-[#6b7280] hover:text-fg-secondary',
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
            scaleExtra === 'normal' ? 'text-[#5eead4]' : 'text-[#6b7280] hover:text-fg-secondary',
          )}
          title="Auto / linear"
        >
          auto
        </button>
      </div>
    </div>
  );
}

function DisplayToggleRow({
  label,
  on,
  onClick,
}: {
  label: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 px-2 py-1.5 text-left text-[11px] hover:bg-white/5"
    >
      <span className="text-fg-secondary">{label}</span>
      <span
        className={cn(
          'h-2 w-2 shrink-0 rounded-full',
          on ? 'bg-[#38bdf8]' : 'bg-[#4b5563]',
        )}
      />
    </button>
  );
}
