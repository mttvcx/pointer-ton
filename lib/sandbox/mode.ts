/**
 * Pointer Sandbox Mode v1 — activation gate.
 *
 * Sandbox mode is OFF unless EXPLICITLY enabled via one of:
 *   - build/env flag:   NEXT_PUBLIC_POINTER_SANDBOX_MODE=1
 *   - runtime opt-in:   localStorage["pointer-sandbox-mode"] === "1"
 *
 * This is the single source of truth. Every sandbox branch in the app MUST
 * gate on `isSandboxMode()` so live mode is never altered when the flag is off.
 * This is distinct from UI "demo mode" and from live trading.
 */

export const SANDBOX_ENV_FLAG = 'NEXT_PUBLIC_POINTER_SANDBOX_MODE';
export const SANDBOX_LOCALSTORAGE_KEY = 'pointer-sandbox-mode';
export const SANDBOX_LEDGER_KEY = 'pointer-sandbox-v1';

/** Custom event so UI can react instantly to runtime enable/disable. */
export const SANDBOX_MODE_EVENT = 'pointer:sandbox-mode-changed';

/** Founder beta is the live-money cohort — sandbox execution must never engage. */
function sandboxHardLocked(): boolean {
  return process.env.NEXT_PUBLIC_FOUNDER_BETA === '1';
}

function envFlagOn(): boolean {
  if (sandboxHardLocked()) return false;
  return process.env.NEXT_PUBLIC_POINTER_SANDBOX_MODE === '1';
}

function localFlagOn(): boolean {
  if (typeof window === 'undefined') return false;
  if (sandboxHardLocked()) return false;
  try {
    return window.localStorage.getItem(SANDBOX_LOCALSTORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * True when sandbox mode is active. Safe on server (env-only there) and client.
 * NEVER returns true unless one of the explicit flags is set.
 */
export function isSandboxMode(): boolean {
  return envFlagOn() || localFlagOn();
}

/** Env flag forces sandbox on and cannot be turned off at runtime. */
export function isSandboxForcedByEnv(): boolean {
  return envFlagOn();
}

export function enableSandboxMode(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SANDBOX_LOCALSTORAGE_KEY, '1');
    window.dispatchEvent(new CustomEvent(SANDBOX_MODE_EVENT, { detail: { enabled: true } }));
  } catch {
    /* no-op */
  }
}

export function disableSandboxMode(): void {
  if (typeof window === 'undefined') return;
  try {
    // Env-forced sandbox cannot be disabled at runtime.
    if (envFlagOn()) return;
    window.localStorage.removeItem(SANDBOX_LOCALSTORAGE_KEY);
    window.dispatchEvent(new CustomEvent(SANDBOX_MODE_EVENT, { detail: { enabled: false } }));
  } catch {
    /* no-op */
  }
}
