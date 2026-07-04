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
 * Per-user account-freeze gate — fail-closed on lookup uncertainty for THIS user
 * only (a throwing check never affects other users). `kind` selects which
 * activity an active control blocks: `trading` (manual + automated order entry,
 * pack opens, fund sends) or `automation` (copy-trade / tracker rules). A
 * `scope: 'all'` freeze blocks both.
 */
export async function checkAccountFreezeGate(
  userId: string,
  kind: 'trading' | 'automation' = 'trading',
): Promise<TradingFreezeGateResult> {
  try {
    const { frozen } = await isActivityFrozen(userId, kind);
    return gateFromFreezeLookup(frozen);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[account-control-gate] freeze lookup failed', {
      userId,
      kind,
      error: message,
    });
    return gateFromLookupFailure(err);
  }
}

/** Returns a blocking NextResponse or null when the activity may proceed. */
export async function accountFreezeGateOrNull(
  userId: string,
  kind: 'trading' | 'automation' = 'trading',
): Promise<NextResponse | null> {
  const result = await checkAccountFreezeGate(userId, kind);
  const payload = tradingFreezeGateHttpPayload(result);
  if (!payload) return null;
  return NextResponse.json(payload.body, { status: payload.status });
}

/** @deprecated use {@link checkAccountFreezeGate}. Trading-kind shim. */
export const checkTradingFreezeGate = (userId: string) => checkAccountFreezeGate(userId, 'trading');

/** @deprecated use {@link accountFreezeGateOrNull}. Trading-kind shim. */
export const tradingFreezeGateOrNull = (userId: string) => accountFreezeGateOrNull(userId, 'trading');
