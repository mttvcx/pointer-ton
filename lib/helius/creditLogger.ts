import 'server-only';

import { insertHeliusUsage } from '@/lib/db/heliusUsage';
import { recordOpsEvent } from '@/lib/ops/events';

/** Helius billing: DAS methods cost 10 credits; standard RPC costs 1. */
export const HELIUS_CREDITS = {
  DAS: 10,
  RPC: 1,
} as const;

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
  const timestamp = new Date().toISOString();
  const startedAt = Date.now();
  let success = false;
  let errMessage: string | null = null;
  try {
    const result = await fn();
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
