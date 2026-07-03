/** Shared types for the Pointer Financial capital layer (card + account). */

export type CardState = 'virtual' | 'physical' | 'frozen';

export type CardInfo = {
  last4: string;
  brand: string; // e.g. 'Pointer'
  state: CardState;
  monthlyLimit: number;
  kycTier: number; // 0 none · 1 lite (name+country) · 2 full
  inWallet: boolean; // provisioned to Apple Pay
};

export type FinStatus = 'unactivated' | 'activating' | 'active';

export type FinSnapshot = { status: FinStatus; card: CardInfo | null };
