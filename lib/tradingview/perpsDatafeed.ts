'use client';

import type {
  ResolutionString,
  TvBar,
  TvDatafeed,
  TvPeriodParams,
  TvSymbolInfo,
} from '@/types/tradingview';

type PerpCandle = { time: number; open: number; high: number; low: number; close: number };

const SUPPORTED: ResolutionString[] = ['1', '5', '15', '60', '240', '1D'];

/** TradingView resolution → Hyperliquid candle timeframe. */
function toTf(resolution: ResolutionString): string {
  switch (resolution) {
    case '1':
      return '1m';
    case '5':
      return '5m';
    case '15':
      return '15m';
    case '60':
      return '1H';
    case '240':
      return '4H';
    case 'D':
    case '1D':
      return '1D';
    default:
      return '15m';
  }
}

function priceScaleFor(price: number): number {
  if (!price || !Number.isFinite(price) || price <= 0) return 100;
  if (price >= 1000) return 10;
  if (price >= 1) return 1000;
  const digits = Math.max(2, Math.ceil(-Math.log10(price)) + 4);
  return 10 ** Math.min(digits, 12);
}

/** TradingView datafeed backed by Hyperliquid candles (`/api/perps/candles`). */
export function createPerpsDatafeed(coin: string): TvDatafeed {
  const subs = new Map<string, number>();

  async function fetchCandles(tf: string): Promise<PerpCandle[]> {
    try {
      const r = await fetch(`/api/perps/candles?coin=${encodeURIComponent(coin)}&tf=${encodeURIComponent(tf)}`);
      if (!r.ok) return [];
      const j = (await r.json()) as { candles?: PerpCandle[] };
      return Array.isArray(j.candles) ? j.candles : [];
    } catch {
      return [];
    }
  }

  const toTv = (c: PerpCandle): TvBar => ({
    time: c.time * 1000,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
  });

  return {
    onReady(cb) {
      setTimeout(() => cb({ supported_resolutions: SUPPORTED, supports_time: true }), 0);
    },

    async resolveSymbol(_name, onResolve, onError) {
      try {
        const bars = await fetchCandles('15m');
        const sample = bars.length ? bars[bars.length - 1]!.close : 0;
        const info: TvSymbolInfo = {
          name: `${coin}/USD`,
          ticker: `${coin}-PERP`,
          description: `${coin} Perpetual`,
          type: 'crypto',
          session: '24x7',
          timezone: 'Etc/UTC',
          exchange: 'Hyperliquid',
          listed_exchange: 'Hyperliquid',
          format: 'price',
          minmov: 1,
          pricescale: priceScaleFor(sample),
          has_intraday: true,
          has_daily: true,
          has_weekly_and_monthly: false,
          supported_resolutions: SUPPORTED,
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
        if (!periodParams.firstDataRequest) {
          onResult([], { noData: true });
          return;
        }
        const bars = (await fetchCandles(toTf(resolution))).map(toTv);
        onResult(bars, { noData: bars.length === 0 });
      } catch {
        onError('getbars_failed');
      }
    },

    subscribeBars(_symbolInfo, resolution, onTick, listenerGuid) {
      const tf = toTf(resolution);
      const poll = async () => {
        const bars = await fetchCandles(tf);
        const last = bars[bars.length - 1];
        if (last) onTick(toTv(last));
      };
      const timer = window.setInterval(() => void poll(), 6_000);
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
  };
}
