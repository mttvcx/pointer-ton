import { useSyncExternalStore } from 'react';

/**
 * Lightweight in-session store for client-only UI state that spans screens —
 * watchlist (token mints), follows (trader handles), and the profile bio. Demo
 * mode: lives in memory (resets on reload). Swap for AsyncStorage/API later.
 */
type Store = { watchlist: Set<string>; follows: Set<string>; bio: string };
const store: Store = { watchlist: new Set(), follows: new Set(), bio: '' };

const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
const subscribe = (cb: () => void) => {
  subs.add(cb);
  return () => void subs.delete(cb);
};

// ---- watchlist ----
export function toggleWatch(mint: string) {
  const next = new Set(store.watchlist);
  next.has(mint) ? next.delete(mint) : next.add(mint);
  store.watchlist = next;
  emit();
}
export const useWatchlist = () => useSyncExternalStore(subscribe, () => store.watchlist);
export const useIsWatched = (mint: string) => useSyncExternalStore(subscribe, () => store.watchlist.has(mint));

// ---- follows ----
export function toggleFollow(handle: string) {
  const next = new Set(store.follows);
  next.has(handle) ? next.delete(handle) : next.add(handle);
  store.follows = next;
  emit();
}
export const useIsFollowing = (handle: string) => useSyncExternalStore(subscribe, () => store.follows.has(handle));
export const useFollowCount = () => useSyncExternalStore(subscribe, () => store.follows.size);

// ---- bio ----
export function setBio(v: string) {
  store.bio = v;
  emit();
}
export const useBio = () => useSyncExternalStore(subscribe, () => store.bio);

// ---- limit orders (real client-side feature; demo persistence) ----
export type OrderSide = 'buy' | 'sell';
export type LimitOrder = {
  id: number;
  mint: string;
  symbol: string;
  side: OrderSide;
  amountUsd: number;
  limitPrice: number;
  expiry: string; // '1h' | '4h' | '24h' | 'Never'
};

let orderSeq = 0;
let orders: LimitOrder[] = [];

export function addOrder(o: Omit<LimitOrder, 'id'>) {
  orders = [{ ...o, id: ++orderSeq }, ...orders];
  emit();
}
export function cancelOrder(id: number) {
  orders = orders.filter((o) => o.id !== id);
  emit();
}
/** Returns the full (stable-ref) orders list; filter by mint in the component. */
export const useOrders = () => useSyncExternalStore(subscribe, () => orders);
