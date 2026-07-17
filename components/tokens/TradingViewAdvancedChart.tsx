'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPointerDatafeed } from '@/lib/tradingview/datafeed';
import type { ResolutionString, TvWidget } from '@/types/tradingview';

const LIBRARY_PATH = '/charting_library/';
const SCRIPT_SRC = '/charting_library/charting_library.standalone.js';

let scriptPromise: Promise<void> | null = null;

/** Load the vendored standalone build once; resolves when `window.TradingView` is ready. */
function loadTradingView(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no_window'));
  if (window.TradingView?.widget) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SCRIPT_SRC;
    s.async = true;
    s.onload = () => (window.TradingView?.widget ? resolve() : reject(new Error('tv_no_global')));
    s.onerror = () => {
      scriptPromise = null;
      reject(new Error('tv_script_failed'));
    };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

/**
 * TradingView Advanced Charts, themed to Pointer, fed by GeckoTerminal OHLCV via
 * the Pointer datafeed. Renders `fallback` (the classic lightweight-charts panel)
 * if the licensed library can't load — so the chart area never goes blank.
 */
export function TradingViewAdvancedChart({
  mint,
  symbol,
  interval = '5',
  edgeToEdge,
  fallback,
}: {
  mint: string;
  symbol: string | null;
  interval?: ResolutionString;
  edgeToEdge?: boolean;
  fallback?: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<TvWidget | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let disposed = false;
    setFailed(false);

    loadTradingView()
      .then(() => {
        if (disposed || !containerRef.current || !window.TradingView) return;
        const tick = (symbol ?? 'TOKEN').replace(/^\$+/, '') || 'TOKEN';
        const widget = new window.TradingView.widget({
          symbol: `${tick}/USD`,
          interval,
          container: containerRef.current,
          datafeed: createPointerDatafeed(mint, symbol),
          library_path: LIBRARY_PATH,
          locale: 'en',
          theme: 'dark',
          autosize: true,
          timezone: 'Etc/UTC',
          disabled_features: [
            'header_symbol_search',
            'symbol_search_hot_key',
            'header_compare',
            'header_saveload',
            'use_localstorage_for_settings',
            'popup_hints',
            'go_to_date',
          ],
          enabled_features: ['hide_left_toolbar_by_default', 'items_favoriting'],
          favorites: { intervals: ['1', '5', '15', '60', '1D'] },
          overrides: {
            'paneProperties.background': '#0b0b0d',
            'paneProperties.backgroundType': 'solid',
            'paneProperties.vertGridProperties.color': 'rgba(255,255,255,0.04)',
            'paneProperties.horzGridProperties.color': 'rgba(255,255,255,0.04)',
            'scalesProperties.textColor': '#8b92a4',
            'scalesProperties.lineColor': 'rgba(255,255,255,0.08)',
            'mainSeriesProperties.candleStyle.upColor': '#34d399',
            'mainSeriesProperties.candleStyle.downColor': '#fb7185',
            'mainSeriesProperties.candleStyle.borderUpColor': '#34d399',
            'mainSeriesProperties.candleStyle.borderDownColor': '#fb7185',
            'mainSeriesProperties.candleStyle.wickUpColor': '#34d399',
            'mainSeriesProperties.candleStyle.wickDownColor': '#fb7185',
          },
          loading_screen: { backgroundColor: '#0b0b0d', foregroundColor: '#7C5CFF' },
          toolbar_bg: '#0b0b0d',
        });
        widgetRef.current = widget;
      })
      .catch(() => {
        if (!disposed) setFailed(true);
      });

    return () => {
      disposed = true;
      try {
        widgetRef.current?.remove();
      } catch {
        // widget may not have finished initialising
      }
      widgetRef.current = null;
    };
  }, [mint, symbol, interval]);

  if (failed && fallback) return <>{fallback}</>;

  return (
    <div
      className={
        edgeToEdge
          ? 'h-full min-h-0 w-full'
          : 'h-full min-h-0 w-full overflow-hidden rounded-sm border border-border-subtle'
      }
    >
      <div ref={containerRef} className="h-full min-h-0 w-full" />
    </div>
  );
}
