/**
 * Pure trading freeze gate — no I/O. Used by trade routes and unit tests.
 */

export const ACCOUNT_FROZEN_MESSAGE =
  'Trading is temporarily unavailable on this account. Please try again later or contact support.';

export const ACCOUNT_CONTROL_UNAVAILABLE_MESSAGE =
  'Trading is temporarily unavailable while account status is verified. Please try again shortly.';

export type AccountControlScope = 'all' | 'trading' | 'automation';

export type FreezeControlLike = {
  status: string;
  scope: string;
} | null;

export type TradingFreezeGateResult =
  | { allowed: true }
  | {
      allowed: false;
      error: 'account_frozen';
      status: 423;
      message: string;
    }
  | {
      allowed: false;
      error: 'account_control_unavailable';
      status: 503;
      message: string;
    };

/** Whether an active control blocks the given activity kind. */
export function blocksActivityForKind(
  control: FreezeControlLike,
  kind: 'trading' | 'automation',
): boolean {
  if (!control || control.status !== 'frozen') return false;
  const scope = control.scope as AccountControlScope;
  return scope === 'all' || scope === kind;
}

/** Gate outcome when account_controls lookup succeeded for this user. */
export function gateFromFreezeLookup(frozen: boolean): TradingFreezeGateResult {
  if (!frozen) return { allowed: true };
  return {
    allowed: false,
    error: 'account_frozen',
    status: 423,
    message: ACCOUNT_FROZEN_MESSAGE,
  };
}

/** Fail-closed when we cannot determine freeze state for this specific user. */
export function gateFromLookupFailure(_cause?: unknown): TradingFreezeGateResult {
  return {
    allowed: false,
    error: 'account_control_unavailable',
    status: 503,
    message: ACCOUNT_CONTROL_UNAVAILABLE_MESSAGE,
  };
}

export function tradingFreezeGateHttpPayload(
  result: TradingFreezeGateResult,
): { status: number; body: { error: string; message: string } } | null {
  if (result.allowed) return null;
  return { status: result.status, body: { error: result.error, message: result.message } };
}
