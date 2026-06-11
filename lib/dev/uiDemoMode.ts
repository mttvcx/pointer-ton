/**
 * Opt-in synthetic data for polishing empty UI states when backends are quiet.
 *
 * Enable either:
 * - `NEXT_PUBLIC_UI_DEMO_MODE=1` or `true` in .env.local (rebuild after change), or
 * - In the browser console: `localStorage.setItem('pointer-ui-demo','1')` then reload.
 * - `NEXT_PUBLIC_POINTER_TABLE_DEMO=1` (rebuild) fills token detail bottom tables with synthetic rows for
 *   layout review only; does not toggle global UI demo.
 *
 * Explore only: force on with `?explore_demo=1`, or force real empty state with `?explore_demo=0`.
 */

export const UI_DEMO_STORAGE_KEY = 'pointer-ui-demo';

/**
 * Founder beta / production lock: demo surfaces must never activate, even via
 * localStorage. Founder beta is the live-money desktop cohort.
 */
function demoHardLocked(): boolean {
  if (process.env.NEXT_PUBLIC_FOUNDER_BETA === '1') return true;
  return process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_UI_DEMO_MODE !== '1';
}

export function uiDemoModeFromEnv(): boolean {
  if (demoHardLocked()) return false;
  const v = process.env.NEXT_PUBLIC_UI_DEMO_MODE;
  if (v === '0' || v === 'false') return false;
  return v === '1' || v === 'true';
}

/** Browser-only: session override without rebuild. Disabled in founder beta/prod. */
export function readUiDemoLocalStorage(): boolean {
  if (typeof window === 'undefined') return false;
  if (demoHardLocked()) return false;
  try {
    return window.localStorage.getItem(UI_DEMO_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function preferTokenTableDemoRows(): boolean {
  if (demoHardLocked()) return false;
  const v = process.env.NEXT_PUBLIC_POINTER_TABLE_DEMO;
  return v === '1' || v === 'true';
}

export function isUiDemoMode(): boolean {
  if (demoHardLocked()) return false;
  const v = process.env.NEXT_PUBLIC_UI_DEMO_MODE;
  if (v === '0' || v === 'false') return false;
  if (v === '1' || v === 'true') return true;
  return readUiDemoLocalStorage();
}
