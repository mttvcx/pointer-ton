import { useSyncExternalStore } from 'react';
import type { TierId } from './tiers';

/**
 * Cash vs Credit spending mode — the "spend without selling" engine.
 *
 * CASH: spend your USDC balance directly.
 * CREDIT: borrow USDC against your SOL/ETH/BTC collateral (Kamino) at the moment
 * you spend. Your crypto stays invested + earning; you never sell → no taxable
 * event. Borrow is over-collateralized with a health factor + liquidation guard.
 *
 * The numbers here are the client model (demo + illustrative rates). Real mode
 * wires to `/api/financial/credit` (Kamino borrow quote) once keyed — same shape.
 */

export type SpendMode = 'cash' | 'credit';

// Risk + rate params (conservative; volatile collateral).
export const MAX_LTV = 0.5; // borrow up to 50% of collateral value
export const LIQ_LTV = 0.75; // liquidation threshold
export const USER_BORROW_APR = 0.11; // APR we charge on the credit line
export const KAMINO_APR = 0.06; // our cost of funds (illustrative) → 5% spread

let mode: SpendMode = 'cash';
let borrowed = 0; // outstanding credit-mode balance (USD)
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
const subscribe = (cb: () => void) => {
  subs.add(cb);
  return () => void subs.delete(cb);
};

export function setSpendMode(m: SpendMode) {
  mode = m;
  emit();
}
export const useSpendMode = () => useSyncExternalStore(subscribe, () => mode);
export const spendModeNow = () => mode;

export function borrow(amountUsd: number) {
  borrowed = Math.max(0, Math.round((borrowed + amountUsd) * 100) / 100);
  emit();
}
export function repay(amountUsd: number) {
  borrowed = Math.max(0, Math.round((borrowed - amountUsd) * 100) / 100);
  emit();
}
export const useBorrowed = () => useSyncExternalStore(subscribe, () => borrowed);
export const borrowedNow = () => borrowed;

// ---- membership tier (which card the user holds) ----
let currentTier: TierId = 'basic';
export function setTier(t: TierId) {
  currentTier = t;
  emit();
}
export const useTier = () => useSyncExternalStore(subscribe, () => currentTier);
export const tierNow = () => currentTier;

/* ---------------- borrow math ---------------- */

/** How much more you can borrow against `collateralUsd` given what's outstanding. */
export function creditAvailable(collateralUsd: number, borrowedUsd: number): number {
  return Math.max(0, collateralUsd * MAX_LTV - borrowedUsd);
}

/** Health factor: >1 safe, ≤1 liquidatable. Infinity when nothing is borrowed. */
export function healthFactor(collateralUsd: number, borrowedUsd: number): number {
  if (borrowedUsd <= 0) return Infinity;
  return (collateralUsd * LIQ_LTV) / borrowedUsd;
}

/** How far collateral can fall before liquidation, as a %. */
export function liquidationDropPct(collateralUsd: number, borrowedUsd: number): number {
  if (borrowedUsd <= 0 || collateralUsd <= 0) return 100;
  const floor = borrowedUsd / LIQ_LTV; // collateral value that triggers liquidation
  return Math.max(0, (1 - floor / collateralUsd) * 100);
}

export type HealthBand = 'safe' | 'moderate' | 'risky';
export function healthBand(hf: number): HealthBand {
  if (!Number.isFinite(hf) || hf >= 1.6) return 'safe';
  if (hf >= 1.25) return 'moderate';
  return 'risky';
}

/** Annual interest the user pays on their outstanding credit line. */
export function annualInterest(borrowedUsd: number): number {
  return borrowedUsd * USER_BORROW_APR;
}
