/**
 * Your pulls — the cards/tokens you've opened. Session-local for now (demo opens
 * are simulated); the real build hydrates from the account's open history.
 */
import { useSyncExternalStore } from 'react';
import type { PackReward } from './api';

let pulls: PackReward[] = [];
const listeners = new Set<() => void>();

export function addPulls(rewards: PackReward[]) {
  pulls = [...rewards, ...pulls];
  listeners.forEach((l) => l());
}

export function usePulls(): PackReward[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => pulls,
    () => pulls,
  );
}
