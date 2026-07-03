/**
 * Pointer Financial activation store — is the capital layer set up for this user,
 * and what card do they hold. A tiny external store (same shape as the toast one)
 * so any screen can read/subscribe.
 *
 * DEMO (Expo Go): starts UNACTIVATED so the first-run journey is always
 * demoable; activation is simulated locally (no real bank/card).
 * REAL build: `loadFinancialStatus()` hydrates from `/api/financial/status`; if
 * the backend isn't configured yet (no Bridge keys / DB down) it degrades to the
 * same local simulation so the flow is never dead in testing.
 */
import { useSyncExternalStore } from 'react';
import { DEMO } from '../auth';
import { activateFinancial, fetchFinancialStatus, type ActivateInput } from './api';
import type { CardInfo, FinSnapshot } from './types';

let snap: FinSnapshot = { status: 'unactivated', card: null };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const set = (next: FinSnapshot) => {
  snap = next;
  emit();
};

export function useFinancial(): FinSnapshot {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => snap,
    () => snap,
  );
}

// Deterministic-ish fresh virtual card for the simulated path.
function makeDemoCard(tier: number): CardInfo {
  const last4 = String(1000 + Math.floor(Math.random() * 9000));
  return { last4, brand: 'Pointer', state: 'virtual', monthlyLimit: 5000, kycTier: tier, inWallet: false };
}

export function beginActivation() {
  set({ ...snap, status: 'activating' });
}

/** Finish activation: use the server-issued card if the backend is live, else a
 *  simulated virtual card. `tier` reflects how much KYC the user completed. */
export async function completeActivation(input: ActivateInput): Promise<CardInfo> {
  let card: CardInfo | null = null;
  if (!DEMO) {
    try {
      const r = await activateFinancial(input);
      if (r.configured && r.card) card = r.card;
    } catch {
      // fall through to simulated card
    }
  }
  if (!card) card = makeDemoCard(input.fullKyc ? 2 : 1);
  set({ status: 'active', card });
  return card;
}

export function setCardFrozen(frozen: boolean) {
  if (!snap.card) return;
  set({ ...snap, card: { ...snap.card, state: frozen ? 'frozen' : 'virtual' } });
}

export function setCardInWallet(inWallet: boolean) {
  if (!snap.card) return;
  set({ ...snap, card: { ...snap.card, inWallet } });
}

/** Re-run the journey (demo convenience). */
export function resetFinancial() {
  set({ status: 'unactivated', card: null });
}

/** REAL build: hydrate from the server on mount. No-op in demo. */
export async function loadFinancialStatus() {
  if (DEMO) return;
  try {
    const r = await fetchFinancialStatus();
    if (r.configured && r.status === 'active' && r.card) set({ status: 'active', card: r.card });
  } catch {
    // leave as unactivated → journey still available
  }
}
