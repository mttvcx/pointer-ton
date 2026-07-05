import 'server-only';

import type { ProviderStatus } from '@/sibyl/data/providers/types';
import { sibylMockMode } from '@/sibyl/config';

/**
 * Birdeye — OHLCV / price history / liquidity / holders. Key-gated stub for MVP.
 * Env: BIRDEYE_API_KEY (header `X-API-KEY`). Falls back to a synthetic candle set.
 */
export function birdeyeStatus(): ProviderStatus {
  return {
    name: 'birdeye',
    configured: Boolean(process.env.BIRDEYE_API_KEY?.trim()) && !sibylMockMode(),
    envVars: ['BIRDEYE_API_KEY'],
    note: 'OHLCV + holders. Stubbed until a key is added.',
  };
}

export type Candle = { time: number; open: number; high: number; low: number; close: number };

/** Synthetic-but-plausible candles so ChartCard renders in mock mode. */
function mockCandles(count = 120): Candle[] {
  let p = 0.0000018;
  const now = Math.floor(Date.now() / 1000);
  return Array.from({ length: count }, (_, i) => {
    const drift = 1 + (((i * 7) % 13) - 5) / 400;
    const open = p;
    p = Math.max(1e-9, p * drift);
    const close = p;
    const high = Math.max(open, close) * 1.01;
    const low = Math.min(open, close) * 0.99;
    return { time: now - (count - i) * 300, open, high, low, close };
  });
}

export async function getCandles(mint: string, _tf = '5m'): Promise<Candle[]> {
  const key = process.env.BIRDEYE_API_KEY?.trim();
  if (sibylMockMode() || !key) return mockCandles();
  // TODO: GET https://public-api.birdeye.so/defi/ohlcv?address=... (X-API-KEY: key)
  return mockCandles();
}
