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
export const useFollows = () => useSyncExternalStore(subscribe, () => store.follows);

// ---- copy trading ----
// Copying a TRADER (not a token): you allocate a size per copied trade. Demo
// persistence (in-memory); live mirroring wires to the trade path on the dev build.
export type CopyRel = { handle: string; name: string; color: string; initial: string; sizeUsd: number };
let copies: Record<string, CopyRel> = {};
export function startCopy(rel: CopyRel) {
  copies = { ...copies, [rel.handle]: rel };
  emit();
}
export function stopCopy(handle: string) {
  const next = { ...copies };
  delete next[handle];
  copies = next;
  emit();
}
export const useCopy = (handle: string): CopyRel | undefined => useSyncExternalStore(subscribe, () => copies[handle]);
export const useCopies = () => useSyncExternalStore(subscribe, () => copies);

// ---- bio ----
export function setBio(v: string) {
  store.bio = v;
  emit();
}
export const useBio = () => useSyncExternalStore(subscribe, () => store.bio);

// ---- advanced quick-buy prefs ----
// `ultra` = one-tap instant buy straight from a screener row (outline button).
// `sol`   = the amount each quick-buy spends. Demo persistence (in-memory).
export type SecondButton = 'off' | 'buy' | 'sell';
export type QuickBuyPrefs = {
  ultra: boolean; // Ultra = the whole token row is an outlined tap-to-buy button
  sol: number; // primary quick-buy amount
  secondButton: SecondButton; // optional second action on each row
  secondSol: number; // amount for the second buy button (when secondButton === 'buy')
};
let quickBuy: QuickBuyPrefs = { ultra: false, sol: 0.1, secondButton: 'off', secondSol: 1 };
export function setQuickBuyUltra(v: boolean) {
  quickBuy = { ...quickBuy, ultra: v };
  emit();
}
export function setQuickBuySol(v: number) {
  quickBuy = { ...quickBuy, sol: v };
  emit();
}
export function setQuickBuySecondButton(v: SecondButton) {
  quickBuy = { ...quickBuy, secondButton: v };
  emit();
}
export function setQuickBuySecondSol(v: number) {
  quickBuy = { ...quickBuy, secondSol: v };
  emit();
}
export const useQuickBuyPrefs = () => useSyncExternalStore(subscribe, () => quickBuy);

// ---- pulse alert sound/haptic (demo: a haptic buzz when a new coin lands) ----
let pulseSound = true;
export function setPulseSound(v: boolean) {
  pulseSound = v;
  emit();
}
export const usePulseSound = () => useSyncExternalStore(subscribe, () => pulseSound);

// ---- alert push prefs (which alert types ping the phone) ----
export type NotifPrefs = {
  trackedWallets: boolean;
  xMonitor: boolean;
  priceAlerts: boolean;
  autoBuyFills: boolean;
};
let notif: NotifPrefs = { trackedWallets: true, xMonitor: true, priceAlerts: true, autoBuyFills: true };
export function setNotifPref(k: keyof NotifPrefs, v: boolean) {
  notif = { ...notif, [k]: v };
  emit();
}
export const useNotifPrefs = () => useSyncExternalStore(subscribe, () => notif);

// ---- automation rules (sniping / auto-buy / alerts — web parity) ----
// Demo persistence (in-memory). The rule UI + store are real; live firing wires
// to the real trade path + alerts stream with the dev build.
export type RuleTrigger = 'x_ca' | 'x_keyword' | 'tracked_wallet' | 'price' | 'image_match';
export type AutoRule = {
  id: number;
  trigger: RuleTrigger;
  target: string;
  buySol: number; // 0 = notify only
  cooldownSec: number;
  dailyCapSol: number;
  enabled: boolean;
};
let killSwitch = false;
let ruleSeq = 3;
let rules: AutoRule[] = [
  { id: 1, trigger: 'x_ca', target: '@cupseyy', buySol: 0.1, cooldownSec: 30, dailyCapSol: 5, enabled: true },
  { id: 2, trigger: 'tracked_wallet', target: 'Euris · buys > $5k', buySol: 0, cooldownSec: 0, dailyCapSol: 0, enabled: true },
  { id: 3, trigger: 'price', target: '$piss → 2x', buySol: 0, cooldownSec: 0, dailyCapSol: 0, enabled: false },
];
export function addRule(r: Omit<AutoRule, 'id'>) {
  rules = [{ ...r, id: ++ruleSeq }, ...rules];
  emit();
}
export function toggleRule(id: number) {
  rules = rules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r));
  emit();
}
export function removeRule(id: number) {
  rules = rules.filter((r) => r.id !== id);
  emit();
}
export function setKillSwitch(v: boolean) {
  killSwitch = v;
  emit();
}
export const useAutoRules = () => useSyncExternalStore(subscribe, () => rules);
export const useKillSwitch = () => useSyncExternalStore(subscribe, () => killSwitch);

// ---- token chart prefs (timeframe + price/MC axis; persist within session) ----
export type ChartAxis = 'price' | 'mc';
let chartTf = '1H';
let chartAxis: ChartAxis = 'price';
export function setChartTf(v: string) {
  chartTf = v;
  emit();
}
export function setChartAxis(v: ChartAxis) {
  chartAxis = v;
  emit();
}
export const useChartTf = () => useSyncExternalStore(subscribe, () => chartTf);
export const useChartAxis = () => useSyncExternalStore(subscribe, () => chartAxis);

// ---- trade execution prefs (slippage + MEV; surfaced in Settings → Trading) ----
export type MevMode = 'off' | 'fast' | 'secure';
let tradeSlippage = 5; // percent
let tradeMev: MevMode = 'fast';
export function setTradeSlippage(v: number) {
  tradeSlippage = v;
  emit();
}
export function setTradeMev(v: MevMode) {
  tradeMev = v;
  emit();
}
export const useTradeSlippage = () => useSyncExternalStore(subscribe, () => tradeSlippage);
export const useTradeMev = () => useSyncExternalStore(subscribe, () => tradeMev);

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
