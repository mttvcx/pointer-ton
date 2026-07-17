/**
 * Minimal typings for the vendored TradingView Advanced Charts *standalone*
 * build. The full types ship in `public/charting_library/charting_library.d.ts`
 * (841 exports), but the library is loaded at runtime via `window.TradingView`
 * from the standalone script — importing the module would bundle 31MB. We
 * declare only the surface Pointer's datafeed + widget wrapper actually use.
 */

export type ResolutionString = string;
export type ThemeName = 'light' | 'dark';

export interface TvBar {
  /** UNIX time in **milliseconds**. */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

/** A bar mark (dot under/over a bar). `imageUrl` renders an avatar inside it. */
export interface TvMark {
  id: string | number;
  time: number; // seconds
  color: { border: string; background: string };
  text: string;
  label: string;
  labelFontColor: string;
  minSize: number;
  borderWidth?: number;
  hoveredBorderWidth?: number;
  imageUrl?: string;
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
  has_seconds?: boolean;
  seconds_multipliers?: string[];
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
  getMarks?(
    symbolInfo: TvSymbolInfo,
    from: number,
    to: number,
    onData: (marks: TvMark[]) => void,
    resolution: ResolutionString,
  ): void;
}

export interface TvWidgetOptions {
  symbol: string;
  interval: ResolutionString;
  container: HTMLElement;
  datafeed: TvDatafeed;
  library_path: string;
  locale: string;
  theme?: ThemeName;
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
  settings_overrides?: Record<string, string | number | boolean>;
  auto_save_delay?: number;
  client_id?: string;
  user_id?: string;
  custom_formatters?: {
    priceFormatterFactory?: (
      symbolInfo: TvSymbolInfo | null,
      minTick: string,
    ) => { format: (price: number, signPositive?: boolean) => string } | null;
  };
}

export interface TvContextMenuItem {
  position: 'top' | 'bottom';
  text: string;
  click: () => void;
}

export interface TvSubscription<T> {
  subscribe(guid: null, callback: T): void;
}

export interface TvChartApi {
  refreshMarks(): void;
  clearMarks(): void;
  resetData(): void;
  setSymbol(symbol: string, options?: { dataReady?: () => void } | (() => void)): Promise<boolean>;
  resolution(): ResolutionString;
  onIntervalChanged(): TvSubscription<(interval: ResolutionString) => void>;
}

export interface TvCreateButtonOptions {
  align?: 'left' | 'right';
  useTradingViewStyle: false;
}

export interface TvWidget {
  onChartReady(cb: () => void): void;
  headerReady(): Promise<void>;
  remove(): void;
  changeTheme(theme: ThemeName, options?: { disableUndo?: boolean }): Promise<void>;
  applyOverrides(overrides: Record<string, string | number | boolean>): void;
  onContextMenu(callback: (unixTime: number, price: number) => TvContextMenuItem[]): void;
  activeChart(): TvChartApi;
  createButton(options?: TvCreateButtonOptions): HTMLElement;
  setSymbol?(symbol: string, interval: ResolutionString, cb: () => void): void;
}

declare global {
  interface Window {
    TradingView?: {
      widget: new (options: TvWidgetOptions) => TvWidget;
    };
  }
}
