'use client';

/** Shared loader for the vendored TradingView Advanced Charts standalone build. */
export const TV_LIBRARY_PATH = '/charting_library/';
const SCRIPT_SRC = '/charting_library/charting_library.standalone.js';

let scriptPromise: Promise<void> | null = null;

export function loadTradingView(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no_window'));
  if (window.TradingView?.widget) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SCRIPT_SRC;
    s.async = true;
    s.onload = () => (window.TradingView?.widget ? resolve() : reject(new Error('tv_no_global')));
    s.onerror = () => {
      scriptPromise = null;
      reject(new Error('tv_script_failed'));
    };
    document.head.appendChild(s);
  });
  return scriptPromise;
}
