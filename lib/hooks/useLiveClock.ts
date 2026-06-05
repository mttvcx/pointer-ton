'use client';

import { useSyncExternalStore } from 'react';

/** Age labels don't need 1s precision — slower tick = fewer Pulse row re-renders. */
const TICK_MS = 5_000;

let nowMs = Date.now();
let intervalId: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (intervalId == null) {
    intervalId = setInterval(() => {
      nowMs = Date.now();
      for (const fn of listeners) fn();
    }, TICK_MS);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && intervalId != null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };
}

function getSnapshot(): number {
  return nowMs;
}

function getServerSnapshot(): number {
  return Date.now();
}

/** Shared 1s clock — one interval for all age/countdown labels (no per-row timers). */
export function useLiveClock(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
