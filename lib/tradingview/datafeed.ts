'use client';

import type { ChartInterval } from '@/lib/helius/chart';
import type {
  ResolutionString,
  TvBar,
  TvDatafeed,
  TvMark,
  TvPeriodParams,
  TvSymbolInfo,
} from '@/types/tradingview';

type ApiBar = { time: number; open: number; high: number; low: number; close: number };
type ChartResponse = { mint: string; interval: ChartInterval; bars: ApiBar[] };

const SUPPORTED_RESOLUTIONS: ResolutionString[] = ['1S', '1', '3', '5', '15', '60', '1D', '5D'];

/** Live, mutable view config the header toggles mutate; the datafeed reads it. */
export type ViewConfig = {
  mode: 'price' | 'mc';
  quote: 'usd' | 'sol';
  supply: number | null;
  nativeUsd: number | null;
  nativeTicker: string;
};

/** TradingView resolution → Pointer chart interval (nearest available source bucket). */
function toInterval(resolution: ResolutionString): ChartInterval {
  switch (resolution) {
    case '1S':
    case '15S':
      return '1s';
    case '1':
      return '1m';
    case '3':
      return '3m';
    case '5':
      return '5m';
    case '15':
      return '15m';
    case '60':
    case '240':
      return '1h';
    case 'D':
    case '1D':
      return '1d';
    case '5D':
      return '5d';
    default:
      return '5m';
  }
}

/** Apply the active MC/price + USD/SOL transform to a raw USD price. */
function transform(v: number, cfg: ViewConfig): number {
  let x = v;
  if (cfg.mode === 'mc' && cfg.supply != null && cfg.supply > 0) x *= cfg.supply;
  if (cfg.quote === 'sol' && cfg.nativeUsd != null && cfg.nativeUsd > 0) x /= cfg.nativeUsd;
  return x;
}

/**
 * Price scale for the transformed value. TradingView shows `1/pricescale`
 * precision — memecoin prices need ~10 decimals, market caps need ~none.
 */
function priceScaleFor(value: number): number {
  if (!value || !Number.isFinite(value) || value <= 0) return 100_000;
  if (value >= 100) return 100; // market caps / large numbers → 2 decimals
  const digits = Math.max(2, Math.ceil(-Math.log10(value)) + 4);
  return 10 ** Math.min(digits, 16);
}

export type DatafeedMarkFetcher = (from: number, to: number) => Promise<TvMark[]>;

/**
 * A TradingView datafeed backed by Pointer's chart endpoint (GeckoTerminal
 * OHLCV under the hood). `cfg` is read live so MC/price + USD/SOL toggles apply
 * without rebuilding the datafeed. `fetchMarks` supplies trade bubbles.
 */
export function createPointerDatafeed(
  mint: string,
  symbol: string | null,
  cfg: ViewConfig,
  opts?: { fetchMarks?: DatafeedMarkFetcher },
): TvDatafeed {
  const tick = (symbol ?? 'TOKEN').replace(/^\$+/, '') || 'TOKEN';
  const subs = new Map<string, number>();

  async function fetchBars(interval: ChartInterval): Promise<ApiBar[]> {
    try {
      const r = await fetch(`/api/tokens/${encodeURIComponent(mint)}/chart?interval=${interval}`);
      if (!r.ok) return [];
      const j = (await r.json()) as ChartResponse;
      return Array.isArray(j.bars) ? j.bars : [];
    } catch {
      return [];
    }
  }

  const toTv = (b: ApiBar): TvBar => ({
    time: b.time * 1000,
    open: transform(b.open, cfg),
    high: transform(b.high, cfg),
    low: transform(b.low, cfg),
    close: transform(b.close, cfg),
  });

  return {
    onReady(cb) {
      setTimeout(
        () =>
          cb({
            supported_resolutions: SUPPORTED_RESOLUTIONS,
            supports_marks: true,
            supports_timescale_marks: false,
            supports_time: true,
          }),
        0,
      );
    },

    async resolveSymbol(_symbolName, onResolve, onError) {
      try {
        const bars = await fetchBars('5m');
        const sample = bars.length ? transform(bars[bars.length - 1]!.close, cfg) : 0;
        const quoteLabel = cfg.quote === 'sol' ? cfg.nativeTicker : 'USD';
        const label = cfg.mode === 'mc' ? `${tick} MC/${quoteLabel}` : `${tick}/${quoteLabel}`;
        const info: TvSymbolInfo = {
          name: label,
          // Vary the ticker with mode/quote so setSymbol re-resolves on toggle
          // (a constant ticker makes TradingView dedupe and skip the re-resolve).
          // The datafeed ignores this and always uses its closure `mint`.
          ticker: label,
          description: label,
          type: 'crypto',
          session: '24x7',
          timezone: 'Etc/UTC',
          exchange: 'Pointer',
          listed_exchange: 'Pointer',
          format: 'price',
          minmov: 1,
          pricescale: priceScaleFor(sample),
          has_intraday: true,
          has_seconds: true,
          seconds_multipliers: ['1'],
          has_daily: true,
          has_weekly_and_monthly: false,
          supported_resolutions: SUPPORTED_RESOLUTIONS,
          volume_precision: 2,
          data_status: 'streaming',
        };
        onResolve(info);
      } catch {
        onError('resolve_failed');
      }
    },

    async getBars(_symbolInfo, resolution, periodParams: TvPeriodParams, onResult, onError) {
      try {
        // The endpoint returns one recent window; older paged requests have no data.
        if (!periodParams.firstDataRequest) {
          onResult([], { noData: true });
          return;
        }
        const bars = await fetchBars(toInterval(resolution));
        const out = bars.map(toTv);
        onResult(out, { noData: out.length === 0 });
      } catch {
        onError('getbars_failed');
      }
    },

    subscribeBars(_symbolInfo, resolution, onTick, listenerGuid) {
      const interval = toInterval(resolution);
      const poll = async () => {
        const bars = await fetchBars(interval);
        const last = bars[bars.length - 1];
        if (last) onTick(toTv(last));
      };
      const timer = window.setInterval(() => void poll(), 8_000);
      subs.set(listenerGuid, timer);
      void poll();
    },

    unsubscribeBars(listenerGuid) {
      const timer = subs.get(listenerGuid);
      if (timer != null) {
        window.clearInterval(timer);
        subs.delete(listenerGuid);
      }
    },

    getMarks(_symbolInfo, from, to, onData) {
      if (!opts?.fetchMarks) {
        onData([]);
        return;
      }
      void opts
        .fetchMarks(from, to)
        .then((marks) => onData(marks))
        .catch(() => onData([]));
    },
  };
}
