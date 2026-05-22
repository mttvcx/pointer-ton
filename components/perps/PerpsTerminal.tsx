'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEMO_PREDICTION_MARKETS } from '@/lib/perps/predictionMarketsDemo';
import { PredictionMarketTicker } from '@/components/perps/PredictionMarketTicker';
import { PredictionMarketSidebar } from '@/components/perps/PredictionMarketSidebar';
import { PredictionMarketDetailModal } from '@/components/perps/PredictionMarketDetailModal';
import { PerpMarketPicker } from '@/components/perps/PerpMarketPicker';
import { DEMO_PERP_MARKETS, fmtPerpUsdCompact, type PerpMarket } from '@/lib/perps/perpMarketsDemo';
import { cn } from '@/lib/utils/cn';
import { formatNumber } from '@/lib/utils/formatters';

const DEFAULT_PAIR = DEMO_PERP_MARKETS[0]!;

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

function PerpAssetIcon({ src, compact }: { src: string; compact?: boolean }) {
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-md ring-1 ring-white/[0.08] bg-[#0c1018]',
        compact ? 'h-5 w-5' : 'h-6 w-6',
      )}
      aria-hidden
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- static public brand mark */}
      <img src={src} alt="" width={compact ? 18 : 22} height={compact ? 18 : 22} className="h-[85%] w-[85%] object-contain" draggable={false} />
    </span>
  );
}

const TIMEFRAMES = ['1m', '5m', '15m', '1H', '4H', '1D'] as const;

export function PerpsTerminal() {
  const [pairId, setPairId] = useState(DEFAULT_PAIR.id);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [tf, setTf] = useState<(typeof TIMEFRAMES)[number]>('15m');
  const [bottomSplit, setBottomSplit] = useState(0.2);
  const splitRef = useRef<HTMLDivElement>(null);
  const vertDrag = useRef(false);
  const vertStart = useRef({ y: 0, split: 0.2 });

  const pair = DEMO_PERP_MARKETS.find((p) => p.id === pairId) ?? DEFAULT_PAIR;

  const onVertDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    vertDrag.current = true;
    vertStart.current = { y: e.clientY, split: bottomSplit };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [bottomSplit]);

  const onVertMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!vertDrag.current || !splitRef.current) return;
    const h = Math.max(1, splitRef.current.getBoundingClientRect().height);
    const dy = e.clientY - vertStart.current.y;
    const next = vertStart.current.split + dy / h;
    setBottomSplit(Math.min(0.52, Math.max(0.12, next)));
  }, []);

  const onVertUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    vertDrag.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* no-op */
    }
  }, []);

  const detailMarket = useMemo(
    () => DEMO_PREDICTION_MARKETS.find((m) => m.id === detailId) ?? null,
    [detailId],
  );

  return (
    <div className="flex min-h-full w-full min-w-0 flex-col bg-bg-base text-fg-primary xl:h-[calc(100dvh-var(--app-topbar-h)-var(--app-bottombar-h)-8px)] xl:max-h-[calc(100dvh-var(--app-topbar-h)-var(--app-bottombar-h)-8px)] xl:overflow-hidden">
      <div className="shrink-0 border-b border-white/[0.06] bg-[#080b11] px-2 py-1.5">
        <div className="flex min-w-0 items-stretch gap-1.5 overflow-x-auto">
          {DEMO_PERP_MARKETS.slice(0, 3).map((p) => {
            const on = p.id === pair.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPairId(p.id)}
                className={cn(
                  'group/tab flex min-w-[8.5rem] items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left transition-colors',
                  on
                    ? 'border-accent-primary/55 bg-[#102033] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]'
                    : 'border-white/[0.07] bg-[#0b0f17] hover:border-white/[0.12] hover:bg-[#101621]',
                )}
              >
                <PerpAssetIcon src={p.iconSrc} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[11px] font-semibold tracking-tight text-fg-primary">
                      {p.coin}
                      <span className="font-medium text-fg-muted">/</span>
                      USD
                    </span>
                    <span
                      className={cn(
                        'rounded px-1 py-px text-[7px] font-semibold uppercase tracking-wide',
                        on ? 'bg-accent-primary/18 text-accent-glow' : 'bg-white/[0.04] text-fg-muted',
                      )}
                    >
                      Perp
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-baseline gap-x-2">
                    <span className="text-[11px] font-semibold tabular-nums text-fg-primary">
                      $
                      {formatNumber(p.mark, {
                        decimals: p.mark > 500 ? (p.mark > 5000 ? 0 : 1) : 2,
                      })}
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
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="shrink-0 border-b border-white/[0.06] bg-[#06090f] px-2 py-1.5">
        <div className="flex flex-wrap items-start gap-x-3 gap-y-2 sm:gap-x-3.5 md:gap-x-4">
          <PerpMarketPicker selectedId={pairId} onSelect={setPairId} />
          <Stat label="Mark" value={`$${formatNumber(pair.mark, { decimals: pair.mark > 500 ? (pair.mark > 5000 ? 0 : 1) : 2 })}`} />
          <Stat
            label="24h"
            value={`${pair.chg24 >= 0 ? '+' : ''}${pair.chg24.toFixed(2)}%`}
            valueClass={pair.chg24 >= 0 ? 'text-signal-bull' : 'text-signal-bear'}
          />
          <Stat
            label="Funding · next"
            value={`${pair.fundingApr.toFixed(1)}% APR`}
            sub={`in ${pair.fundingCountdown}`}
          />
          <Stat label="Open interest" value={fmtPerpUsdCompact(pair.oiUsd)} />
          <Stat label="24h volume" value={fmtPerpUsdCompact(pair.vol24Usd)} />
          <Stat label="Index" value="Composite" sub="synthetic benchmark" muted />
        </div>
      </div>

      <PredictionMarketTicker onOpenMarket={(id) => setDetailId(id)} />

      <div ref={splitRef} className="flex w-full min-w-0 flex-col xl:min-h-0 xl:flex-1">
        <div
          className="grid w-full min-w-0 grid-cols-1 gap-px bg-white/[0.06] xl:min-h-0 xl:grid-cols-[minmax(0,1fr)_13.25rem_20rem]"
          style={{ flex: `${1 - bottomSplit} 1 0%`, minHeight: 0 }}
        >
          <section className="flex min-h-[280px] min-w-0 flex-col overflow-hidden bg-[#070a10] xl:min-h-0">
            <ChartShell pair={pair} tf={tf} onTfChange={setTf} />
          </section>

          <section className="flex min-h-[220px] min-w-0 flex-col overflow-hidden bg-[#080c12] xl:min-h-0">
            <header className="flex items-center justify-between border-b border-white/[0.06] px-2.5 py-2">
              <h2 className="text-[11px] font-semibold tracking-tight text-fg-secondary">Order book</h2>
              <span className="text-[9px] tabular-nums text-fg-muted">L2 demo</span>
            </header>
            <OrderBookPreview coin={pair.coin} mark={pair.mark} />
          </section>

          <section className="flex min-h-0 min-w-0 flex-col bg-[#070a10]">
            <OrderEntryPreview pair={pair} />
            <PredictionMarketSidebar className="min-h-0 flex-1 overflow-auto border-t border-white/[0.06]" />
          </section>
        </div>

        <div
          role="separator"
          aria-label="Resize chart versus lower panels"
          onPointerDown={onVertDown}
          onPointerMove={onVertMove}
          onPointerUp={onVertUp}
          onPointerCancel={onVertUp}
          className="group relative z-10 hidden h-1 shrink-0 cursor-row-resize bg-transparent xl:block"
        >
          <div className="pointer-events-none absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-white/[0.08] group-hover:bg-accent-primary/45" />
        </div>

        <div className="shrink-0" style={{ flex: `${bottomSplit} 1 0%`, minHeight: '6.5rem' }}>
          <BottomTabs />
        </div>
      </div>

      <PredictionMarketDetailModal
        open={Boolean(detailId && detailMarket)}
        market={detailMarket}
        onClose={() => setDetailId(null)}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  valueClass,
  muted,
}: {
  label: string;
  value: string;
  sub?: string;
  valueClass?: string;
  muted?: boolean;
}) {
  return (
    <div className="min-w-0 shrink-0">
      <div className="text-[9px] font-medium capitalize tracking-wide text-fg-muted/85">{label}</div>
      <div
        className={cn(
          'mt-0.5 truncate text-[11px] font-semibold tracking-tight',
          muted ? 'text-fg-muted' : 'text-fg-primary',
          valueClass,
        )}
      >
        {value}
      </div>
      {sub ? <div className="mt-px truncate text-[9px] text-fg-muted/80">{sub}</div> : null}
    </div>
  );
}

function ChartShell({
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
  const dec = pair.mark > 500 ? (pair.mark > 5000 ? 0 : 1) : 2;
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
        backgroundColor: '#070a10',
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
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] bg-[#080c12] px-2.5 py-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[12px] font-semibold tracking-tight text-fg-primary">{pair.label}</span>
          <span className="rounded bg-white/[0.05] px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-fg-secondary">
            ${formatNumber(pair.mark, { decimals: dec })}
          </span>
          <span className="hidden text-[10px] text-fg-muted sm:inline">{pair.tvSymbol}</span>
        </div>
        <div className="flex flex-wrap items-center gap-0.5">
          {TIMEFRAMES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onTfChange(t)}
              className={cn(
                'rounded px-2 py-1 text-[10px] font-semibold tabular-nums transition-colors',
                tf === t
                  ? 'bg-accent-primary/20 text-accent-glow shadow-[inset_0_0_0_1px_rgb(var(--accent-glow-rgb)/0.28)]'
                  : 'text-fg-muted hover:bg-white/[0.05] hover:text-fg-secondary',
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="relative min-h-[300px] flex-1 overflow-hidden bg-[#070a10] lg:min-h-0">
        <div className="absolute inset-0" id={containerId} />
        <div
          className={cn(
            'pointer-events-none absolute inset-0 flex items-center justify-center bg-[#070a10] text-center text-[11px] text-fg-muted transition-opacity',
            widgetLoaded ? 'opacity-0' : 'opacity-100',
          )}
        >
          <div>
            <p className="font-medium text-fg-secondary">Loading TradingView</p>
            <p className="mt-1 text-fg-muted/80">Free embeddable widget, no API key required</p>
          </div>
        </div>
      </div>
    </>
  );
}

function OrderBookPreview({ coin, mark }: { coin: string; mark: number }) {
  const asks = [0.00145, 0.00124, 0.00105, 0.00086, 0.00068, 0.00052, 0.00037, 0.00024].map((o) => mark + o * mark);
  const bids = [0.00023, 0.00036, 0.00051, 0.00067, 0.00084, 0.00102, 0.00121, 0.0014].map((o) => mark - o * mark);
  const dec = mark > 500 ? (mark > 5000 ? 0 : 1) : 2;
  const askDepth = [92, 82, 73, 61, 54, 43, 35, 28];
  const bidDepth = [31, 38, 46, 57, 66, 74, 83, 90];

  return (
    <div className="flex min-h-0 flex-1 flex-col text-[10px] tabular-nums">
      <div className="grid grid-cols-[1fr_1fr_1fr] gap-1 border-b border-white/[0.04] px-2 py-1.5 text-[8px] font-semibold uppercase tracking-wide text-fg-muted/90">
        <span>Price</span>
        <span className="text-right">{`Size (${coin})`}</span>
        <span className="text-right">Total</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {asks.map((p, i) => (
          <div
            key={`ask-${String(p)}-${String(i)}`}
            className="relative grid grid-cols-[1fr_1fr_1fr] items-center gap-1 px-2 py-[2px] text-signal-bear/95"
          >
            <div
              className="pointer-events-none absolute inset-y-0 right-0 bg-signal-bear/[0.12]"
              style={{ width: `${askDepth[i] ?? 32}%` }}
            />
            <span className="relative z-[1] font-medium">{formatNumber(p, { decimals: dec })}</span>
            <span className="relative z-[1] text-right font-medium text-fg-secondary">
              {formatNumber(120 + i * 31, { decimals: 2 })}
            </span>
            <span className="relative z-[1] text-right text-fg-muted">
              {formatNumber((120 + i * 31) * p * 0.002, { decimals: 1 })}k
            </span>
          </div>
        ))}
      </div>
      <div className="shrink-0 border-y border-white/[0.05] bg-black/20 px-2 py-1.5 text-center">
        <span className="text-[10px] font-semibold text-fg-secondary">Spread</span>
        <span className="mx-2 text-[10px] text-fg-muted/80">·</span>
        <span className="text-[10px] tabular-nums text-fg-primary">6.8 bps</span>
        <span className="ml-2 text-[9px] text-fg-muted">demo</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {bids.map((p, i) => (
          <div
            key={`bid-${String(p)}-${String(i)}`}
            className="relative grid grid-cols-[1fr_1fr_1fr] items-center gap-1 px-2 py-[2px] text-signal-bull/95"
          >
            <div
              className="pointer-events-none absolute inset-y-0 right-0 bg-signal-bull/[0.12]"
              style={{ width: `${bidDepth[i] ?? 32}%` }}
            />
            <span className="relative z-[1] font-medium">{formatNumber(p, { decimals: dec })}</span>
            <span className="relative z-[1] text-right font-medium text-fg-secondary">
              {formatNumber(95 + i * 22, { decimals: 2 })}
            </span>
            <span className="relative z-[1] text-right text-fg-muted">
              {formatNumber((95 + i * 22) * p * 0.002, { decimals: 1 })}k
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function OrderEntryPreview({ pair }: { pair: PerpMarket }) {
  const [side, setSide] = useState<'long' | 'short'>('long');
  const [mode, setMode] = useState<'market' | 'limit'>('market');

  const accent =
    side === 'long'
      ? {
          btn: 'bg-[#35e0a1] text-[#03100b] hover:bg-[#3bf0ad]',
          slider: 'bg-[#35e0a1]',
        }
      : {
          btn: 'bg-signal-bear text-white hover:bg-signal-bear/90',
          slider: 'bg-signal-bear',
        };

  return (
    <div className="overflow-hidden bg-[#080c12]">
      <div className="flex gap-2 border-b border-white/[0.06] p-2">
        <div className="flex flex-1 rounded-md bg-black/35 p-0.5 ring-1 ring-white/[0.06]">
          {(['market', 'limit'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                'flex-1 rounded py-1.5 text-[11px] font-semibold capitalize transition-colors',
                mode === m ? 'bg-white/[0.09] text-fg-primary' : 'text-fg-muted hover:text-fg-secondary',
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="px-2 pt-2">
        <div className="grid grid-cols-2 gap-1 rounded-md bg-black/35 p-0.5 ring-1 ring-white/[0.05]">
          <button
            type="button"
            onClick={() => setSide('long')}
            className={cn(
              'rounded py-2 text-[12px] font-semibold tracking-tight transition-colors',
              side === 'long'
                ? 'bg-[#35e0a1] text-[#03100b]'
                : 'bg-transparent text-fg-muted hover:bg-white/[0.04] hover:text-fg-secondary',
            )}
          >
            Long
          </button>
          <button
            type="button"
            onClick={() => setSide('short')}
            className={cn(
              'rounded py-2 text-[12px] font-semibold tracking-tight transition-colors',
              side === 'short'
                ? 'bg-signal-bear text-white'
                : 'bg-transparent text-fg-muted hover:bg-white/[0.04] hover:text-fg-secondary',
            )}
          >
            Short
          </button>
        </div>
      </div>

      <div className="space-y-3 px-2.5 py-3">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium text-fg-muted">Size</span>
            <span className="text-[10px] text-fg-muted">Available targets are simulated</span>
          </div>
          <div className="mt-1 flex items-center gap-2 rounded-md bg-black/30 py-2 pl-2 pr-3 ring-1 ring-white/[0.06]">
            <PerpAssetIcon src={pair.iconSrc} compact />
            <input
              readOnly
              value="0.00"
              aria-label={`Size in ${pair.coin}`}
              className="min-w-0 flex-1 bg-transparent py-1 text-[18px] font-semibold tabular-nums tracking-tight text-fg-primary outline-none"
            />
            <span className="hidden text-[11px] font-medium uppercase text-fg-muted sm:inline">{pair.coin}</span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium text-fg-muted">Leverage · isolated</span>
            <span className="text-[11px] font-semibold tabular-nums text-fg-secondary">7.5x</span>
          </div>
          <div className="relative h-1.5 rounded-full bg-white/[0.07]">
            <div
              className={cn(
                'absolute left-0 top-0 h-full w-[52%] rounded-full',
                accent.slider,
              )}
            />
            <span className="absolute left-[52%] top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/80 bg-[#101620]" />
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-md bg-black/25 px-3 py-2.5 text-[10px] ring-1 ring-white/[0.04]">
          <Row k="Est. liquidation" v="—" hint="demo" />
          <Row k="Margin" v="$0.00" />
          <Row k="Fees" v="0.02% / 0.05%" hint="maker / taker" />
          <Row k="Funding" v={`+${pair.fundingApr}% APR`} />
          <Row k="Buying power" v="$12,420" className="col-span-2" hint="subset of wallet · demo" />
        </dl>

        <button
          type="button"
          className={cn(
            'w-full rounded-md py-2.5 text-[13px] font-semibold tracking-tight transition-colors active:scale-[0.99]',
            accent.btn,
          )}
        >
          Preview order
        </button>
        <p className="text-center text-[10px] leading-relaxed text-fg-muted">
          Demo route: sizing and risk preview only.
        </p>
      </div>
    </div>
  );
}

function Row({
  k,
  v,
  hint,
  className,
}: {
  k: string;
  v: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <dt className="text-fg-muted">{k}</dt>
      <dd className="mt-0.5 font-semibold tabular-nums text-fg-primary">{v}</dd>
      {hint ? <p className="mt-px text-[9px] text-fg-muted/85">{hint}</p> : null}
    </div>
  );
}

function BottomTabs() {
  const tabs = ['Positions', 'Open orders', 'Trades'] as const;
  const [t, setT] = useState(0);
  return (
    <div className="shrink-0 border-t border-white/[0.06] bg-[#06090f]">
      <div className="flex flex-wrap gap-1 border-b border-white/[0.05] px-2 py-1.5">
        {tabs.map((name, i) => (
          <button
            key={name}
            type="button"
            onClick={() => setT(i)}
            className={cn(
              'rounded px-3 py-1.5 text-[11px] font-semibold tracking-tight transition-colors',
              t === i ? 'bg-accent-primary/16 text-accent-glow ring-1 ring-accent-primary/35' : 'text-fg-muted hover:bg-white/[0.04] hover:text-fg-secondary',
            )}
          >
            {name}
          </button>
        ))}
      </div>
      <div className="px-4 py-7 text-center">
        <p className="text-[12px] font-semibold text-fg-secondary">No open positions</p>
        <p className="mx-auto mt-1 max-w-md text-[11px] leading-relaxed text-fg-muted">
          Positions will appear here after orders execute on a connected venue.
        </p>
      </div>
    </div>
  );
}
