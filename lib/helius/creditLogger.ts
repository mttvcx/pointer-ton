import 'server-only';

import { insertHeliusUsage } from '@/lib/db/heliusUsage';
import { recordOpsEvent } from '@/lib/ops/events';
import { guardProvider } from '@/lib/providers/circuitBreaker';

/** Helius billing: DAS methods cost 10 credits; standard RPC costs 1. */
export const HELIUS_CREDITS = {
  DAS: 10,
  RPC: 1,
} as const;

/**
 * Resilience: bound every Helius/RPC call so a slow/hanging provider fails fast
 * instead of hanging the request 15-20s+ (the outage-day token-API hang was an
 * unbounded DAS call). Tunable via HELIUS_TIMEOUT_MS. The underlying call isn't
 * cancellable (web3.js), but the caller is unblocked and the finally-block below
 * still logs it as a failure.
 */
const HELIUS_TIMEOUT_MS = Number(process.env.HELIUS_TIMEOUT_MS) || 10_000;

function withHeliusTimeout<T>(p: Promise<T>): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`helius_timeout_${HELIUS_TIMEOUT_MS}ms`)), HELIUS_TIMEOUT_MS),
    ),
  ]);
}

export type HeliusUsageLog = {
  endpoint: string;
  credits_estimated: number;
  timestamp: string;
  success: boolean;
};

/**
 * Wrap a Helius/RPC call, log credit estimate, and persist to `helius_usage`.
 */
export async function heliusCall<T>(
  endpoint: string,
  estimatedCredits: number,
  fn: () => Promise<T>,
): Promise<T> {
  // Circuit breaker — charge the estimate and HARD-CUTOFF (throws) when Helius
  // is over budget or manually disabled. Fails open on a Redis blip.
  await guardProvider('helius', estimatedCredits);
  const timestamp = new Date().toISOString();
  const startedAt = Date.now();
  let success = false;
  let errMessage: string | null = null;
  try {
    const result = await withHeliusTimeout(fn());
    success = true;
    return result;
  } catch (err) {
    errMessage = err instanceof Error ? err.message : String(err);
    throw err;
  } finally {
    const entry: HeliusUsageLog = {
      endpoint,
      credits_estimated: estimatedCredits,
      timestamp,
      success,
    };
    if (process.env.NODE_ENV === 'development') {
      console.debug('[helius-usage]', entry);
    }
    void insertHeliusUsage({
      endpoint: entry.endpoint,
      credits_estimated: entry.credits_estimated,
      success: entry.success,
      created_at: entry.timestamp,
    }).catch((err) => {
      console.warn('[helius-usage] persist failed:', err instanceof Error ? err.message : err);
    });
    // High-frequency provider: record only FAILURES to ops_events (volume/credits
    // already live in helius_usage) so the event log stays signal, not noise.
    if (!success) {
      void recordOpsEvent({
        category: 'provider',
        name: `helius:${endpoint}`,
        status: 'error',
        severity: 'error',
        durationMs: Date.now() - startedAt,
        message: errMessage,
      });
    }
  }
}

export function heliusDasCredits(method: string): number {
  switch (method) {
    case 'getAsset':
    case 'getAssetsByAuthority':
    case 'searchAssets':
      return HELIUS_CREDITS.DAS;
    default:
      return HELIUS_CREDITS.DAS;
  }
}
