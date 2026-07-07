/**
 * The user's Pointer usage that unlocks card tiers — 30-day trading volume
 * (terminal + mobile combined) and PTR Points. Tiers are EARNED by this, not
 * bought: an active trader already generates fees for us, so their volume funds
 * the card perks. No annual fee, no token gate (no PTR token yet).
 *
 * DEMO: seeded so the user has earned Silver (not yet Gold). REAL build: hydrate
 * from the points/volume API (`/api/points`, trade history) across web + mobile.
 */
import { useSyncExternalStore } from 'react';

let volume30d = 48_200; // clears Silver ($25k), short of Gold ($250k)
let ptrPoints = 12_480;

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function sub(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useVolume30d(): number {
  return useSyncExternalStore(sub, () => volume30d, () => volume30d);
}
export function usePtrPoints(): number {
  return useSyncExternalStore(sub, () => ptrPoints, () => ptrPoints);
}

/** REAL build hydrates these from the API; kept as setters for that + demo tools. */
export function setUsage(next: { volume30d?: number; ptrPoints?: number }) {
  if (next.volume30d != null) volume30d = next.volume30d;
  if (next.ptrPoints != null) ptrPoints = next.ptrPoints;
  emit();
}
