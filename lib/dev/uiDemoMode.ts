/**
 * Opt-in synthetic data for polishing empty UI states when backends are quiet.
 *
 * Enable either:
 * - `NEXT_PUBLIC_UI_DEMO_MODE=1` or `true` in .env.local (rebuild after change), or
 * - In the browser console: `localStorage.setItem('pointer-ui-demo','1')` then reload.
 * - `NEXT_PUBLIC_POINTER_TABLE_DEMO=1` (rebuild) fills token detail bottom tables with synthetic rows for
 *   layout review only; does not toggle global UI demo.
 *
 * Explore only: in `next dev`, empty indexer responses are backfilled with demo bubbles automatically.
 * Force on with `?explore_demo=1`, or force real empty state with `?explore_demo=0`.
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

export function preferTokenTableDemoRows(): boolean {
  const v = process.env.NEXT_PUBLIC_POINTER_TABLE_DEMO;
  return v === '1' || v === 'true';
}

export function isUiDemoMode(): boolean {
  return uiDemoModeFromEnv() || readUiDemoLocalStorage();
}
