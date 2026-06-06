import 'server-only';

import { NextResponse } from 'next/server';
import { isActivityFrozen } from '@/lib/db/accountControls';
import {
  gateFromFreezeLookup,
  gateFromLookupFailure,
  tradingFreezeGateHttpPayload,
  type TradingFreezeGateResult,
} from '@/lib/account/tradingFreezeGate';

/**
 * Per-user trading freeze gate — fail-closed on lookup uncertainty for this user only.
 * Does not affect other users when the check throws.
 */
export async function checkTradingFreezeGate(userId: string): Promise<TradingFreezeGateResult> {
  try {
    const { frozen } = await isActivityFrozen(userId, 'trading');
    return gateFromFreezeLookup(frozen);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[account-control-gate] trading freeze lookup failed', {
      userId,
      error: message,
    });
    return gateFromLookupFailure(err);
  }
}

/** Returns a blocking NextResponse or null when trading may proceed. */
export async function tradingFreezeGateOrNull(userId: string): Promise<NextResponse | null> {
  const result = await checkTradingFreezeGate(userId);
  const payload = tradingFreezeGateHttpPayload(result);
  if (!payload) return null;
  return NextResponse.json(payload.body, { status: payload.status });
}
