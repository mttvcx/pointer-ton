/**
 * Opt-in synthetic data for polishing empty UI states when backends are quiet.
 *
 * Enable either:
 * - `NEXT_PUBLIC_UI_DEMO_MODE=1` or `true` in .env.local (rebuild after change), or
 * - In the browser console: `localStorage.setItem('pointer-ui-demo','1')` then reload.
 */

export const UI_DEMO_STORAGE_KEY = 'pointer-ui-demo';

export function uiDemoModeFromEnv(): boolean {
  const v = process.env.NEXT_PUBLIC_UI_DEMO_MODE;
  return v === '1' || v === 'true';
}

/** Browser-only: session override without rebuild. */
export function readUiDemoLocalStorage(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(UI_DEMO_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function isUiDemoMode(): boolean {
  return uiDemoModeFromEnv() || readUiDemoLocalStorage();
}
