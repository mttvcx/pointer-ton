'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { useUIStore } from '@/store/ui';
import { nativeTicker, nativeUsdTickerSymbol } from '@/lib/chains/nativeCurrency';
import { useNativeUsdSpot } from '@/lib/hooks/useJupiterTickers';
import { createPointerDatafeed, type DatafeedMarkFetcher, type ViewConfig } from '@/lib/tradingview/datafeed';
import { buildChartMarks, defaultMarkFilters, type MarkCategory } from '@/lib/tradingview/marks';
import { mountDisplayMenu } from '@/lib/tradingview/displayOptions';
import { useChartPrefsStore } from '@/store/chartPrefs';
import {
  pointerChartOverrides,
  pointerChromeCss,
  pointerLoadingScreen,
  pointerThemeName,
  pointerToolbarBg,
} from '@/lib/tradingview/theme';
import type { ResolutionString, TvWidget } from '@/types/tradingview';

const LIBRARY_PATH = '/charting_library/';
const SCRIPT_SRC = '/charting_library/charting_library.standalone.js';
const CHROME_STYLE_ID = 'pointer-tv-chrome';

let scriptPromise: Promise<void> | null = null;

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
  const root = document.documentElement;
  const rgb = getComputedStyle(root).getPropertyValue(`${name}-rgb`).trim();
  if (rgb) {
    const p = rgb.split(/\s+/).filter(Boolean);
    if (p.length >= 3) return `rgb(${p.slice(0, 3).join(', ')})`;
  }
  return getComputedStyle(root).getPropertyValue(name).trim() || fallback;
}

/** The exact background the chart sits on — walk up until a solid color is found. */
function resolveContainerBg(el: HTMLElement | null): string {
  let node = el?.parentElement ?? null;
  for (let i = 0; node && i < 8; i++) {
    const bg = getComputedStyle(node).backgroundColor;
    if (bg && bg !== 'transparent' && !bg.replace(/\s/g, '').startsWith('rgba(0,0,0,0)')) return bg;
    node = node.parentElement;
  }
  return cssColor('--bg-raised', '#121214');
}

function fmtPrice(p: number): string {
  if (!Number.isFinite(p) || p <= 0) return '$0';
  if (p >= 1) return `$${p.toFixed(4)}`;
  if (p >= 0.0001) return `$${p.toFixed(6)}`;
  return `$${p.toExponential(2)}`;
}

/** Compact number for the MCap axis/legend — 1.2M, 3.3K, 4.1B, etc. */
function fmtCompact(v: number): string {
  if (!Number.isFinite(v)) return '0';
  const sign = v < 0 ? '-' : '';
  const abs = Math.abs(v);
  if (abs >= 1e12) return `${sign}${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(2)}K`;
  if (abs >= 1) return `${sign}${abs.toFixed(2)}`;
  return `${sign}${abs.toPrecision(3)}`;
}

function applyChromeCss(container: HTMLElement | null, surface?: string) {
  const iframe = container?.querySelector('iframe');
  const doc = iframe?.contentDocument;
  if (!doc) return;
  let style = doc.getElementById(CHROME_STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = doc.createElement('style');
    style.id = CHROME_STYLE_ID;
    doc.head.appendChild(style);
  }
  style.textContent = pointerChromeCss(surface);
}

/** A plain header button styled to sit in the TradingView toolbar. */
function styleHeaderButton(el: HTMLElement) {
  el.style.cursor = 'pointer';
  el.style.padding = '0 8px';
  el.style.height = '100%';
  el.style.display = 'inline-flex';
  el.style.alignItems = 'center';
  el.style.fontSize = '13px';
  el.style.fontWeight = '600';
  el.style.userSelect = 'none';
}

/**
 * TradingView Advanced Charts wired into Pointer: seamless (container-matched)
 * background, theme-reactive chrome, MarketCap/Price + USD/native toggles, real
 * dev/KOL/tracked trade bubbles, and right-click limit/alert. Falls back to the
 * classic panel if the licensed library can't load.
 */
export function TradingViewAdvancedChart({
  mint,
  symbol,
  supplyTokens,
  creatorWallet,
  interval = '5',
  edgeToEdge,
  fallback,
}: {
  mint: string;
  symbol: string | null;
  supplyTokens?: number | null;
  creatorWallet?: string | null;
  interval?: ResolutionString;
  edgeToEdge?: boolean;
  fallback?: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<TvWidget | null>(null);
  const [failed, setFailed] = useState(false);
  const { authenticated, getAccessToken } = usePointerAuth();

  const activeChain = useUIStore((s) => s.activeChain);
  const nativeSym = nativeTicker(activeChain);
  const nativeUsdSpotQ = useNativeUsdSpot(nativeUsdTickerSymbol(activeChain), { staleTime: 60_000 });
  const nativeUsdSpot = nativeUsdSpotQ.data ?? null;

  const tick = (symbol ?? 'TOKEN').replace(/^\$+/, '') || 'TOKEN';

  // Live view config the header toggles mutate; the datafeed reads it directly.
  // Initial values come from the account-synced chart-prefs store so the user's
  // interval / MCap-Price / USD-native / bubble choices persist across sessions
  // and devices (via [[layoutSyncKeys]]).
  const prefs0 = useChartPrefsStore.getState();
  const viewRef = useRef<ViewConfig>({
    mode: prefs0.mode,
    quote: prefs0.quote,
    supply: supplyTokens ?? null,
    nativeUsd: nativeUsdSpot,
    nativeTicker: nativeSym,
  });
  viewRef.current.supply = supplyTokens ?? null;
  viewRef.current.nativeUsd = nativeUsdSpot;
  viewRef.current.nativeTicker = nativeSym;

  const authRef = useRef({ authenticated, getAccessToken });
  authRef.current = { authenticated, getAccessToken };

  // Bubble controls: master "Hide All" + per-category filters (Display Options).
  const hideAllRef = useRef(prefs0.hideAllBubbles);
  const filtersRef = useRef<Record<MarkCategory, boolean>>({
    ...defaultMarkFilters(),
    ...prefs0.markFilters,
  });

  const fetchMarks = useCallback<DatafeedMarkFetcher>(
    async () => {
      if (hideAllRef.current) return [];
      const { authenticated: authed, getAccessToken: getTok } = authRef.current;
      const marks = await buildChartMarks({
        mint,
        creatorWallet: creatorWallet ?? null,
        bull: cssColor('--signal-bull', '#34d399'),
        bear: cssColor('--signal-bear', '#fb7185'),
        authenticated: authed,
        getToken: getTok,
      });
      return marks.filter((m) => filtersRef.current[m.category] !== false);
    },
    [mint, creatorWallet],
  );

  useEffect(() => {
    let disposed = false;
    setFailed(false);
    let themeObserver: MutationObserver | null = null;
    let themeDebounce: number | null = null;
    const refreshTimers: number[] = [];

    // Clean, human label that also varies per mode/quote so setSymbol re-resolves
    // (new pricescale) on toggle. Shows in the chart legend.
    const symbolString = () => {
      const q = viewRef.current.quote === 'sol' ? viewRef.current.nativeTicker : 'USD';
      return viewRef.current.mode === 'mc' ? `${tick} MC/${q}` : `${tick}/${q}`;
    };

    loadTradingView()
      .then(() => {
        if (disposed || !containerRef.current || !window.TradingView) return;
        const bg = resolveContainerBg(containerRef.current);
        const widget = new window.TradingView.widget({
          symbol: symbolString(),
          interval: useChartPrefsStore.getState().interval || interval,
          container: containerRef.current,
          datafeed: createPointerDatafeed(mint, symbol, viewRef.current, { fetchMarks }),
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
          overrides: pointerChartOverrides(bg),
          loading_screen: pointerLoadingScreen(),
          toolbar_bg: bg,
          auto_save_delay: 2,
          // MCap mode → compact axis/legend (1.2M, 3.3K); price mode → default.
          custom_formatters: {
            priceFormatterFactory: () =>
              viewRef.current.mode === 'mc' ? { format: (price: number) => fmtCompact(price) } : null,
          },
        });
        widgetRef.current = widget;

        // Header toggles: MarketCap/Price + USD/native.
        void widget.headerReady().then(() => {
          if (disposed) return;
          const reload = () => void widget.activeChart().setSymbol(symbolString());

          const mcBtn = widget.createButton({ align: 'left', useTradingViewStyle: false });
          styleHeaderButton(mcBtn);
          const paintMc = () => {
            mcBtn.textContent = viewRef.current.mode === 'mc' ? 'MCap' : 'Price';
            mcBtn.style.color = cssColor('--accent-primary', '#7C5CFF');
          };
          paintMc();
          mcBtn.title = 'Toggle Market Cap / Price';
          mcBtn.onclick = () => {
            viewRef.current.mode = viewRef.current.mode === 'mc' ? 'price' : 'mc';
            useChartPrefsStore.getState().setMode(viewRef.current.mode);
            paintMc();
            reload();
          };

          const quoteBtn = widget.createButton({ align: 'left', useTradingViewStyle: false });
          styleHeaderButton(quoteBtn);
          const paintQuote = () => {
            quoteBtn.textContent = viewRef.current.quote === 'sol' ? viewRef.current.nativeTicker : 'USD';
            quoteBtn.style.color = cssColor('--fg-secondary', '#c7ccd6');
          };
          paintQuote();
          quoteBtn.title = `Toggle USD / ${nativeSym}`;
          quoteBtn.onclick = () => {
            viewRef.current.quote = viewRef.current.quote === 'sol' ? 'usd' : 'sol';
            useChartPrefsStore.getState().setQuote(viewRef.current.quote);
            paintQuote();
            reload();
          };

          // Display Options dropdown (Axiom-style bubble category menu).
          const displayBtn = widget.createButton({ align: 'left', useTradingViewStyle: false });
          styleHeaderButton(displayBtn);
          displayBtn.textContent = 'Display Options ▾';
          displayBtn.style.color = cssColor('--fg-secondary', '#c7ccd6');
          displayBtn.title = 'Configure chart display options';
          mountDisplayMenu({
            anchor: displayBtn,
            getState: (k) => filtersRef.current[k] !== false,
            setState: (k, v) => {
              filtersRef.current[k] = v;
              useChartPrefsStore.getState().setMarkFilter(k, v);
            },
            colors: {
              popup: cssColor('--bg-hover', '#1b1b20'),
              border: 'rgba(255,255,255,0.10)',
              text: cssColor('--fg-secondary', '#c7ccd6'),
              muted: cssColor('--fg-muted', '#8b92a4'),
              // Vivid "enabled" dot (theme accent is greyscale) — Axiom uses teal-green.
              accent: cssColor('--signal-bull', '#3ddc97'),
              hover: cssColor('--bg-base', '#0b0b0d'),
            },
            onChange: () => widgetRef.current?.activeChart().refreshMarks(),
          });

          // Hide / Show All Bubbles master toggle.
          const hideBtn = widget.createButton({ align: 'left', useTradingViewStyle: false });
          styleHeaderButton(hideBtn);
          const paintHide = () => {
            hideBtn.textContent = hideAllRef.current ? 'Show All Bubbles' : 'Hide All Bubbles';
            hideBtn.style.color = cssColor('--fg-secondary', '#c7ccd6');
          };
          paintHide();
          hideBtn.title = 'Show / hide all trade bubbles';
          hideBtn.onclick = () => {
            hideAllRef.current = !hideAllRef.current;
            useChartPrefsStore.getState().setHideAllBubbles(hideAllRef.current);
            paintHide();
            const chart = widgetRef.current?.activeChart();
            if (hideAllRef.current) chart?.clearMarks();
            else chart?.refreshMarks();
          };
        });

        widget.onChartReady(() => {
          if (disposed) return;
          applyChromeCss(containerRef.current, resolveContainerBg(containerRef.current));
          // Re-pull marks a couple times as the identity registry hydrates.
          refreshTimers.push(
            window.setTimeout(() => widgetRef.current?.activeChart().refreshMarks(), 2_500),
            window.setTimeout(() => widgetRef.current?.activeChart().refreshMarks(), 7_000),
          );

          // Persist the interval the user picks (account-synced) so it restores next visit.
          try {
            widget
              .activeChart()
              .onIntervalChanged()
              .subscribe(null, (nextInterval) => {
                if (!disposed) useChartPrefsStore.getState().setInterval(nextInterval);
              });
          } catch {
            // interval subscription is best-effort
          }

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

        // Re-theme when Pointer's palette changes. A custom-theme edit fires a
        // burst of inline `--x-rgb` style mutations, so debounce into one pass;
        // only call changeTheme on an actual light<->dark flip (it resets
        // overrides), otherwise just re-apply overrides + chrome from live vars.
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
      refreshTimers.forEach((t) => window.clearTimeout(t));
      try {
        widgetRef.current?.remove();
      } catch {
        // widget may not have finished initialising
      }
      widgetRef.current = null;
    };
  }, [mint, symbol, interval, tick, nativeSym, fetchMarks]);

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
