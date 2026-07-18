'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { loadTradingView, TV_LIBRARY_PATH } from '@/lib/tradingview/loadLibrary';
import { createPerpsDatafeed } from '@/lib/tradingview/perpsDatafeed';
import {
  pointerChartOverrides,
  pointerChromeCss,
  pointerLoadingScreen,
  pointerThemeName,
  pointerToolbarBg,
} from '@/lib/tradingview/theme';
import type { ResolutionString, TvWidget } from '@/types/tradingview';

const CHROME_STYLE_ID = 'pointer-tv-chrome';

function cssColor(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const root = document.documentElement;
  const rgb = getComputedStyle(root).getPropertyValue(`${name}-rgb`).trim();
  if (rgb) {
    const p = rgb.split(/\s+/).filter(Boolean);
    if (p.length >= 3) return `rgb(${p.slice(0, 3).join(', ')})`;
  }
  return getComputedStyle(root).getPropertyValue(name).trim() || fallback;
}

function resolveContainerBg(el: HTMLElement | null): string {
  let node = el?.parentElement ?? null;
  for (let i = 0; node && i < 8; i++) {
    const bg = getComputedStyle(node).backgroundColor;
    if (bg && bg !== 'transparent' && !bg.replace(/\s/g, '').startsWith('rgba(0,0,0,0)')) return bg;
    node = node.parentElement;
  }
  return cssColor('--bg-base', '#0b0b0d');
}

function applyChromeCss(container: HTMLElement | null, surface?: string) {
  const doc = container?.querySelector('iframe')?.contentDocument;
  if (!doc) return;
  let style = doc.getElementById(CHROME_STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = doc.createElement('style');
    style.id = CHROME_STYLE_ID;
    doc.head.appendChild(style);
  }
  style.textContent = pointerChromeCss(surface);
}

/**
 * Perps chart = the SAME TradingView Advanced Charts as the token page, fed by
 * Hyperliquid candles — so perps get the native pro chart UI (intervals, drawing
 * tools, indicators) instead of a bespoke button row. Falls back to `fallback`
 * (the lightweight chart) if the licensed library can't load.
 */
export function PerpsTradingViewChart({
  coin,
  interval = '15',
  fallback,
}: {
  coin: string;
  interval?: ResolutionString;
  fallback?: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<TvWidget | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let disposed = false;
    setFailed(false);
    let themeObserver: MutationObserver | null = null;
    let themeDebounce: number | null = null;

    loadTradingView()
      .then(() => {
        if (disposed || !containerRef.current || !window.TradingView) return;
        const bg = resolveContainerBg(containerRef.current);
        const widget = new window.TradingView.widget({
          symbol: `${coin}/USD`,
          interval,
          container: containerRef.current,
          datafeed: createPerpsDatafeed(coin),
          library_path: TV_LIBRARY_PATH,
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
          enabled_features: ['items_favoriting', 'move_logo_to_main_pane'],
          favorites: { intervals: ['1', '5', '15', '60', '240', '1D'] as ResolutionString[] },
          overrides: pointerChartOverrides(bg),
          loading_screen: pointerLoadingScreen(),
          toolbar_bg: bg,
          auto_save_delay: 2,
        });
        widgetRef.current = widget;

        widget.onChartReady(() => {
          if (!disposed) applyChromeCss(containerRef.current, resolveContainerBg(containerRef.current));
        });

        let lastTheme = pointerThemeName();
        const reTheme = () => {
          const w = widgetRef.current;
          if (disposed || !w) return;
          const applyRest = () => {
            const surface = resolveContainerBg(containerRef.current);
            w.applyOverrides(pointerChartOverrides(surface));
            applyChromeCss(containerRef.current, surface);
          };
          const next = pointerThemeName();
          if (next !== lastTheme) {
            lastTheme = next;
            void w.changeTheme(next).then(applyRest).catch(() => {});
          } else {
            applyRest();
          }
        };
        themeObserver = new MutationObserver(() => {
          if (themeDebounce != null) window.clearTimeout(themeDebounce);
          themeDebounce = window.setTimeout(reTheme, 120);
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
      if (themeDebounce != null) window.clearTimeout(themeDebounce);
      try {
        widgetRef.current?.remove();
      } catch {
        // widget may not have finished initialising
      }
      widgetRef.current = null;
    };
  }, [coin, interval]);

  if (failed && fallback) return <>{fallback}</>;

  return <div ref={containerRef} className="h-full min-h-0 w-full" />;
}
