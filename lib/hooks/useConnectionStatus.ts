'use client';

import { useEffect, useState } from 'react';

export type ConnectionStatus = 'stable' | 'degraded' | 'offline';

/**
 * Single shared connectivity probe.
 *
 * Every consumer (BottomBar, BottomBarStatusRail, …) reads from one
 * module-level probe loop instead of each spinning up its own 30s
 * `setInterval` against `/api/prices/tickers`. The probe is ref-counted: it
 * starts on the first subscriber and tears down on the last.
 *
 * Visibility-aware: the interval is paused while the tab is hidden and resumes
 * (with an immediate probe) on focus, so a backgrounded tab does not keep
 * pinging the API.
 */
const PROBE_INTERVAL_MS = 30_000;

let refCount = 0;
let intervalId: ReturnType<typeof setInterval> | null = null;
let inFlight = false;
let currentStatus: ConnectionStatus = 'stable';
const listeners = new Set<(status: ConnectionStatus) => void>();

function emit(status: ConnectionStatus) {
  if (status === currentStatus) return;
  currentStatus = status;
  for (const l of listeners) l(status);
}

async function probe() {
  if (inFlight) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    emit('offline');
    return;
  }
  inFlight = true;
  const t0 = performance.now();
  try {
    const res = await fetch('/api/prices/tickers', { cache: 'no-store' });
    const ms = performance.now() - t0;
    if (!res.ok) {
      emit('degraded');
      return;
    }
    emit(ms > 900 ? 'degraded' : 'stable');
  } catch {
    emit('offline');
  } finally {
    inFlight = false;
  }
}

function startInterval() {
  if (intervalId != null) return;
  if (typeof document !== 'undefined' && document.hidden) return;
  intervalId = setInterval(() => void probe(), PROBE_INTERVAL_MS);
}

function stopInterval() {
  if (intervalId == null) return;
  clearInterval(intervalId);
  intervalId = null;
}

function onOnline() {
  void probe();
  startInterval();
}

function onOffline() {
  emit('offline');
}

function onVisibility() {
  if (typeof document === 'undefined') return;
  if (document.hidden) {
    stopInterval();
  } else {
    void probe();
    startInterval();
  }
}

function startProbe() {
  refCount += 1;
  if (refCount > 1) return;
  void probe();
  startInterval();
  if (typeof window !== 'undefined') {
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    document.addEventListener('visibilitychange', onVisibility);
  }
}

function stopProbe() {
  refCount = Math.max(0, refCount - 1);
  if (refCount > 0) return;
  stopInterval();
  if (typeof window !== 'undefined') {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
    document.removeEventListener('visibilitychange', onVisibility);
  }
}

/**
 * Lightweight connectivity status derived from the shared probe loop.
 */
export function useConnectionStatus(): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>(currentStatus);

  useEffect(() => {
    setStatus(currentStatus);
    listeners.add(setStatus);
    startProbe();
    return () => {
      listeners.delete(setStatus);
      stopProbe();
    };
  }, []);

  return status;
}
