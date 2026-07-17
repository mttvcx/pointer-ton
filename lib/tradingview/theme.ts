'use client';

import type { ThemeName } from '@/types/tradingview';

/**
 * Bridges Pointer's CSS-variable theme system into TradingView. Everything is
 * read live from `:root` (`--bg-base`, `--signal-bull`, …) so the chart tracks
 * whatever theme is active and re-themes when `data-theme` flips — same way
 * Axiom's chart inherits its terminal palette.
 */

function cssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return raw || fallback;
}

/** `--x-rgb` companion ("r g b") → `rgb(r, g, b)`; falls back to the plain var. */
function cssColor(name: string, fallback: string): string {
  const rgb = cssVar(`${name}-rgb`, '');
  if (rgb) {
    const parts = rgb.split(/\s+/).filter(Boolean);
    if (parts.length >= 3) return `rgb(${parts.slice(0, 3).join(', ')})`;
  }
  return cssVar(name, fallback);
}

function rgbTriplet(name: string, fallback: [number, number, number]): [number, number, number] {
  const rgb = cssVar(`${name}-rgb`, '');
  const parts = rgb.split(/\s+/).filter(Boolean).map(Number);
  if (parts.length >= 3 && parts.every((n) => Number.isFinite(n))) {
    return [parts[0]!, parts[1]!, parts[2]!];
  }
  return fallback;
}

/** Dark vs light, decided by the base-background luminance. */
export function pointerThemeName(): ThemeName {
  const [r, g, b] = rgbTriplet('--bg-base', [11, 11, 13]);
  const luminance = (0.2126 * r + 0.7152 * g + 0.114 * b) / 255;
  return luminance < 0.5 ? 'dark' : 'light';
}

function rgba(name: string, alpha: number, fallback: [number, number, number]): string {
  const [r, g, b] = rgbTriplet(name, fallback);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Chart-pane overrides (background, grid, scales, candle colors). */
export function pointerChartOverrides(): Record<string, string | number | boolean> {
  const bg = cssColor('--bg-base', '#0b0b0d');
  const bull = cssColor('--signal-bull', '#34d399');
  const bear = cssColor('--signal-bear', '#fb7185');
  const grid = rgba('--fg-primary', 0.05, [255, 255, 255]);
  const text = cssColor('--fg-muted', '#8b92a4');
  const scaleLine = rgba('--fg-primary', 0.1, [255, 255, 255]);
  return {
    'paneProperties.background': bg,
    'paneProperties.backgroundType': 'solid',
    'paneProperties.vertGridProperties.color': grid,
    'paneProperties.horzGridProperties.color': grid,
    'paneProperties.crossHairProperties.color': text,
    'paneProperties.legendProperties.showStudyArguments': true,
    'scalesProperties.textColor': text,
    'scalesProperties.lineColor': scaleLine,
    'scalesProperties.backgroundColor': bg,
    'mainSeriesProperties.candleStyle.upColor': bull,
    'mainSeriesProperties.candleStyle.downColor': bear,
    'mainSeriesProperties.candleStyle.borderUpColor': bull,
    'mainSeriesProperties.candleStyle.borderDownColor': bear,
    'mainSeriesProperties.candleStyle.wickUpColor': bull,
    'mainSeriesProperties.candleStyle.wickDownColor': bear,
    'mainSeriesProperties.hollowCandleStyle.upColor': bull,
    'mainSeriesProperties.hollowCandleStyle.downColor': bear,
    'mainSeriesProperties.barStyle.upColor': bull,
    'mainSeriesProperties.barStyle.downColor': bear,
    'mainSeriesProperties.lineStyle.color': cssColor('--accent-primary', '#7C5CFF'),
    'mainSeriesProperties.areaStyle.color1': rgba('--accent-primary', 0.35, [124, 92, 255]),
    'mainSeriesProperties.areaStyle.color2': rgba('--accent-primary', 0, [124, 92, 255]),
    'mainSeriesProperties.areaStyle.linecolor': cssColor('--accent-primary', '#7C5CFF'),
  };
}

export function pointerLoadingScreen(): { backgroundColor: string; foregroundColor: string } {
  return {
    backgroundColor: cssColor('--bg-base', '#0b0b0d'),
    foregroundColor: cssColor('--accent-primary', '#7C5CFF'),
  };
}

export function pointerToolbarBg(): string {
  return cssColor('--bg-raised', '#121214');
}

/**
 * TradingView chrome (toolbar, dropdowns, popups, dialogs) is themed via its
 * documented `--tv-color-*` CSS variables. We map them onto Pointer's palette
 * and inject the result into the widget iframe so menus blend in seamlessly.
 */
export function pointerChromeCss(): string {
  const platform = cssColor('--bg-base', '#0b0b0d');
  const pane = cssColor('--bg-raised', '#121214');
  const popup = cssColor('--bg-raised', '#121214');
  const hover = cssColor('--bg-hover', '#1b1b20');
  const text = cssColor('--fg-secondary', '#c7ccd6');
  const textHover = cssColor('--fg-primary', '#ffffff');
  const muted = cssColor('--fg-muted', '#8b92a4');
  const accent = cssColor('--accent-primary', '#7C5CFF');
  const divider = rgba('--fg-primary', 0.08, [255, 255, 255]);
  return `
:root {
  --tv-color-platform-background: ${platform};
  --tv-color-pane-background: ${pane};
  --tv-color-toolbar-button-background-hover: ${hover};
  --tv-color-toolbar-button-background-secondary-hover: ${hover};
  --tv-color-toolbar-button-background-expanded: ${hover};
  --tv-color-toolbar-button-text: ${text};
  --tv-color-toolbar-button-text-hover: ${textHover};
  --tv-color-toolbar-button-text-active: ${accent};
  --tv-color-toolbar-button-text-active-hover: ${accent};
  --tv-color-toolbar-toggle-button-background-active: ${accent};
  --tv-color-toolbar-toggle-button-background-active-hover: ${accent};
  --tv-color-toolbar-divider-background: ${divider};
  --tv-color-item-active-text: ${textHover};
  --tv-color-popup-background: ${popup};
  --tv-color-popup-element-text: ${text};
  --tv-color-popup-element-text-hover: ${textHover};
  --tv-color-popup-element-background-hover: ${hover};
  --tv-color-popup-element-divider-background: ${divider};
  --tv-color-popup-element-secondary-text: ${muted};
  --tv-color-popup-element-hint-text: ${muted};
}
.chart-page, .layout__area--top, .layout__area--left, .chart-controls-bar {
  background: ${platform} !important;
}
`;
}
