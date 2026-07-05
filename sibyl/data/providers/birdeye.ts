import 'server-only';

import type { ProviderStatus } from '@/sibyl/data/providers/types';
import { sibylForceMock } from '@/sibyl/config';

/**
 * Birdeye — OHLCV / price history / liquidity / holders. Env: BIRDEYE_API_KEY
 * (header `X-API-KEY`). Falls back to a synthetic candle set.
 * NOTE: the real OHLCV fetch is not wired yet — flip REAL_IMPL when it is.
 */
const REAL_IMPL = false;

export function birdeyeStatus(): ProviderStatus {
  return {
    name: 'birdeye',
    configured: Boolean(process.env.BIRDEYE_API_KEY?.trim()) && REAL_IMPL && !sibylForceMock(),
    envVars: ['BIRDEYE_API_KEY'],
    note: REAL_IMPL ? 'OHLCV + holders.' : 'OHLCV + holders. Real fetch pending (mock candles).',
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
  if (!REAL_IMPL || sibylForceMock() || !key) return mockCandles();
  // TODO: GET https://public-api.birdeye.so/defi/ohlcv?address=... (X-API-KEY: key)
  return mockCandles();
}
