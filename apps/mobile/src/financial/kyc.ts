import { useSyncExternalStore } from 'react';
import type { TierId } from './tiers';

/**
 * KYC levels — the legal split that lets us be no-ID for the crypto-native flow
 * and only verify when someone wants a real Visa card.
 *
 *  0 = NONE  → borrow against crypto (Kamino), spend in-app, send USDC. No ID.
 *              The whole "spend without selling" flow lives here, KYC-free.
 *  1 = LITE  → name + country → a virtual card, low limits (Basic / Silver).
 *  2 = FULL  → government ID → physical card + high limits (Gold / Platinum).
 *
 * The card issuer (Bridge/Rain) + the Visa network legally require the ID — that's
 * the only KYC wall. Borrowing/spending on-chain never touches it.
 */
export type KycLevel = 0 | 1 | 2;

export const KYC_LABEL: Record<KycLevel, string> = { 0: 'Not verified', 1: 'Lite verified', 2: 'Fully verified' };

/** What KYC level a membership tier's CARD requires (the borrow itself needs 0). */
export function tierKyc(tier: TierId): KycLevel {
  return tier === 'gold' || tier === 'platinum' ? 2 : 1;
}

/** Human blurb for what each level unlocks. */
export const KYC_UNLOCKS: Record<KycLevel, string> = {
  0: 'Borrow against your crypto, spend in-app, send USDC — no ID needed.',
  1: 'Virtual Pointer Card for online + Apple Pay spend.',
  2: 'Physical card, high limits, and the premium tiers.',
};

let level: KycLevel = 0;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
const subscribe = (cb: () => void) => {
  subs.add(cb);
  return () => void subs.delete(cb);
};

export function setKycLevel(l: KycLevel) {
  level = l;
  emit();
}
export const useKycLevel = () => useSyncExternalStore(subscribe, () => level);
export const kycLevelNow = () => level;
