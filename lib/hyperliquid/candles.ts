import 'server-only';

import { z } from 'zod';
import { HYPERLIQUID_INFO_URL } from '@/lib/hyperliquid/constants';

/**
 * Hyperliquid OHLC candles (`candleSnapshot`) — the data feed behind the perps
 * chart. Rendered in-page with lightweight-charts (like the spot TokenChart), so
 * the chart shows OUR venue's candles seamlessly instead of an embedded
 * TradingView iframe pointed at a Binance symbol.
 */

const num = z.union([z.string(), z.number()]).transform((v) => Number(v));

const HlCandle = z
  .object({
    t: z.number(), // open time (ms)
    o: num,
    h: num,
    l: num,
    c: num,
    v: num.optional(),
  })
  .passthrough();

const HlCandles = z.array(HlCandle);

export type PerpCandle = { time: number; open: number; high: number; low: number; close: number };

/** UI timeframe → Hyperliquid interval + bar length (ms). */
const TF: Record<string, { hl: string; ms: number }> = {
  '1m': { hl: '1m', ms: 60_000 },
  '5m': { hl: '5m', ms: 300_000 },
  '15m': { hl: '15m', ms: 900_000 },
  '1H': { hl: '1h', ms: 3_600_000 },
  '4H': { hl: '4h', ms: 14_400_000 },
  '1D': { hl: '1d', ms: 86_400_000 },
};

export async function fetchPerpCandles(coin: string, tf: string, limit = 300): Promise<PerpCandle[]> {
  const cfg = TF[tf] ?? TF['15m']!;
  const endTime = Date.now();
  const startTime = endTime - cfg.ms * limit;

  const res = await fetch(HYPERLIQUID_INFO_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'candleSnapshot', req: { coin, interval: cfg.hl, startTime, endTime } }),
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`hl_candles_${res.status}`);

  const parsed = HlCandles.safeParse(await res.json());
  if (!parsed.success) return [];

  return parsed.data
    .map((k) => ({
      time: Math.floor(k.t / 1000), // lightweight-charts wants seconds
      open: k.o,
      high: k.h,
      low: k.l,
      close: k.c,
    }))
    .filter((c) => Number.isFinite(c.close) && Number.isFinite(c.open))
    .sort((a, b) => a.time - b.time);
}
