/**
 * Minimal typings for the vendored TradingView Advanced Charts *standalone*
 * build. The full types ship in `public/charting_library/charting_library.d.ts`
 * (841 exports), but the library is loaded at runtime via `window.TradingView`
 * from the standalone script — importing the module would bundle 31MB. We
 * declare only the surface Pointer's datafeed + widget wrapper actually use.
 */

export type ResolutionString = string;

export interface TvBar {
  /** UNIX time in **milliseconds**. */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface TvSymbolInfo {
  name: string;
  ticker?: string;
  description: string;
  type: string;
  session: string;
  timezone: string;
  exchange: string;
  listed_exchange: string;
  format: 'price';
  minmov: number;
  pricescale: number;
  has_intraday: boolean;
  has_daily?: boolean;
  has_weekly_and_monthly?: boolean;
  supported_resolutions: ResolutionString[];
  volume_precision?: number;
  data_status?: 'streaming' | 'endofday' | 'delayed_streaming';
}

export interface TvPeriodParams {
  from: number;
  to: number;
  countBack: number;
  firstDataRequest: boolean;
}

export interface TvDatafeedConfiguration {
  supported_resolutions: ResolutionString[];
  supports_marks?: boolean;
  supports_timescale_marks?: boolean;
  supports_time?: boolean;
}

export interface TvDatafeed {
  onReady(cb: (config: TvDatafeedConfiguration) => void): void;
  resolveSymbol(
    symbolName: string,
    onResolve: (info: TvSymbolInfo) => void,
    onError: (reason: string) => void,
  ): void;
  getBars(
    symbolInfo: TvSymbolInfo,
    resolution: ResolutionString,
    periodParams: TvPeriodParams,
    onResult: (bars: TvBar[], meta: { noData: boolean }) => void,
    onError: (reason: string) => void,
  ): void;
  subscribeBars(
    symbolInfo: TvSymbolInfo,
    resolution: ResolutionString,
    onTick: (bar: TvBar) => void,
    listenerGuid: string,
    onResetCacheNeededCallback: () => void,
  ): void;
  unsubscribeBars(listenerGuid: string): void;
}

export interface TvWidgetOptions {
  symbol: string;
  interval: ResolutionString;
  container: HTMLElement;
  datafeed: TvDatafeed;
  library_path: string;
  locale: string;
  theme?: 'light' | 'dark';
  autosize?: boolean;
  fullscreen?: boolean;
  timezone?: string;
  disabled_features?: string[];
  enabled_features?: string[];
  custom_css_url?: string;
  overrides?: Record<string, string | number | boolean>;
  loading_screen?: { backgroundColor?: string; foregroundColor?: string };
  toolbar_bg?: string;
  favorites?: { intervals?: ResolutionString[] };
}

export interface TvWidget {
  onChartReady(cb: () => void): void;
  remove(): void;
  setSymbol?(symbol: string, interval: ResolutionString, cb: () => void): void;
}

declare global {
  interface Window {
    TradingView?: {
      widget: new (options: TvWidgetOptions) => TvWidget;
    };
  }
}
