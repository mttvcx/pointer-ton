'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { createPointerDatafeed, type DatafeedMarkFetcher } from '@/lib/tradingview/datafeed';
import {
  pointerChartOverrides,
  pointerChromeCss,
  pointerLoadingScreen,
  pointerThemeName,
  pointerToolbarBg,
} from '@/lib/tradingview/theme';
import type { ResolutionString, TvMark, TvWidget } from '@/types/tradingview';

const LIBRARY_PATH = '/charting_library/';
const SCRIPT_SRC = '/charting_library/charting_library.standalone.js';
const CHROME_STYLE_ID = 'pointer-tv-chrome';

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

function cssColor(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const rgb = getComputedStyle(document.documentElement).getPropertyValue(`${name}-rgb`).trim();
  if (rgb) {
    const p = rgb.split(/\s+/).filter(Boolean);
    if (p.length >= 3) return `rgb(${p.slice(0, 3).join(', ')})`;
  }
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

/** Small price formatter that survives sub-cent memecoin prices. */
function fmtPrice(p: number): string {
  if (!Number.isFinite(p) || p <= 0) return '$0';
  if (p >= 1) return `$${p.toFixed(4)}`;
  if (p >= 0.0001) return `$${p.toFixed(6)}`;
  return `$${p.toExponential(2)}`;
}

/** Inject/replace the Pointer chrome stylesheet inside the widget's same-origin iframe. */
function applyChromeCss(container: HTMLElement | null) {
  const iframe = container?.querySelector('iframe');
  const doc = iframe?.contentDocument;
  if (!doc) return;
  let style = doc.getElementById(CHROME_STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = doc.createElement('style');
    style.id = CHROME_STYLE_ID;
    doc.head.appendChild(style);
  }
  style.textContent = pointerChromeCss();
}

/**
 * TradingView Advanced Charts, wired into Pointer:
 * - theme-reactive (tracks `data-theme`, re-themes chart + chrome live)
 * - trade bubbles via the datafeed's `getMarks`
 * - right-click → limit buy/sell + alert, prefilling the Buy/Sell panel
 * Falls back to `fallback` (the classic lightweight-charts panel) if the licensed
 * library can't load, so the chart area never goes blank.
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
  const { authenticated, getAccessToken } = usePointerAuth();

  // Latest auth in a ref so the datafeed closure never goes stale.
  const authRef = useRef({ authenticated, getAccessToken });
  authRef.current = { authenticated, getAccessToken };

  const fetchMarks = useCallback<DatafeedMarkFetcher>(
    async (from, to) => {
      const { authenticated: authed, getAccessToken: getTok } = authRef.current;
      if (!authed) return [];
      const token = await getTok();
      if (!token) return [];
      const r = await fetch(`/api/tokens/${encodeURIComponent(mint)}/wallet-markers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) return [];
      const j = (await r.json()) as {
        markers: { time: number; side: 'buy' | 'sell'; trackerLabel: string | null; txSignature: string }[];
      };
      const bull = cssColor('--signal-bull', '#34d399');
      const bear = cssColor('--signal-bear', '#fb7185');
      return (j.markers ?? [])
        .filter((m) => m.time >= from && m.time <= to)
        .map<TvMark>((m) => {
          const buy = m.side === 'buy';
          return {
            id: m.txSignature,
            time: m.time,
            color: buy ? { border: bull, background: bull } : { border: bear, background: bear },
            text: `${m.trackerLabel ? `${m.trackerLabel} ` : ''}${buy ? 'bought' : 'sold'}`,
            label: buy ? 'B' : 'S',
            labelFontColor: '#0b0b0d',
            minSize: 14,
          };
        });
    },
    [mint],
  );

  useEffect(() => {
    let disposed = false;
    setFailed(false);
    let themeObserver: MutationObserver | null = null;

    loadTradingView()
      .then(() => {
        if (disposed || !containerRef.current || !window.TradingView) return;
        const tick = (symbol ?? 'TOKEN').replace(/^\$+/, '') || 'TOKEN';
        const widget = new window.TradingView.widget({
          symbol: `${tick}/USD`,
          interval,
          container: containerRef.current,
          datafeed: createPointerDatafeed(mint, symbol, { fetchMarks }),
          library_path: LIBRARY_PATH,
          locale: 'en',
          theme: pointerThemeName(),
          autosize: true,
          timezone: 'Etc/UTC',
          disabled_features: [
            'header_symbol_search',
            'symbol_search_hot_key',
            'header_compare',
            'header_quick_search',
            'popup_hints',
            'symbol_info',
            'display_market_status',
          ],
          enabled_features: ['seconds_resolution', 'items_favoriting', 'move_logo_to_main_pane'],
          favorites: { intervals: ['1S', '1', '5', '15', '60', '1D'] as ResolutionString[] },
          overrides: pointerChartOverrides(),
          loading_screen: pointerLoadingScreen(),
          toolbar_bg: pointerToolbarBg(),
          auto_save_delay: 2,
        });
        widgetRef.current = widget;

        widget.onChartReady(() => {
          if (disposed) return;
          applyChromeCss(containerRef.current);

          // Right-click → Pointer order actions (prefill the Buy/Sell panel).
          widget.onContextMenu((_unixTime, price) => {
            const dispatch = (kind: 'limit_buy' | 'limit_sell' | 'alert') => {
              window.dispatchEvent(
                new CustomEvent('pointer:chart-order', { detail: { mint, kind, priceUsd: price } }),
              );
              const verb = kind === 'alert' ? 'Alert' : kind === 'limit_sell' ? 'Limit sell' : 'Limit buy';
              toast.message(`${verb} @ ${fmtPrice(price)}`, { description: 'Loaded into the trade panel.' });
            };
            return [
              { position: 'top', text: `Limit buy @ ${fmtPrice(price)}`, click: () => dispatch('limit_buy') },
              { position: 'top', text: `Limit sell @ ${fmtPrice(price)}`, click: () => dispatch('limit_sell') },
              { position: 'top', text: `Alert @ ${fmtPrice(price)}`, click: () => dispatch('alert') },
            ];
          });
        });

        // Re-theme live when Pointer's `data-theme` flips.
        themeObserver = new MutationObserver(() => {
          const w = widgetRef.current;
          if (!w) return;
          void w
            .changeTheme(pointerThemeName())
            .then(() => {
              w.applyOverrides(pointerChartOverrides());
              applyChromeCss(containerRef.current);
            })
            .catch(() => {});
        });
        themeObserver.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ['data-theme', 'style', 'class'],
        });
      })
      .catch(() => {
        if (!disposed) setFailed(true);
      });

    return () => {
      disposed = true;
      themeObserver?.disconnect();
      try {
        widgetRef.current?.remove();
      } catch {
        // widget may not have finished initialising
      }
      widgetRef.current = null;
    };
  }, [mint, symbol, interval, fetchMarks]);

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
