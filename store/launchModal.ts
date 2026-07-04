'use client';

import { create } from 'zustand';
import type { LaunchImageStrategy, LaunchPackageLaunchpad } from '@/lib/launch/types';

/** Advanced deploy feature toggles (J7-style cards). */
export type LaunchFeatures = {
  /** Pointer 50% creator-fee cashback on this launch. */
  cashback: boolean;
  /** Attach community tasks/quests to the token page. */
  tasks: boolean;
  /** Degen "mayhem" mode — aggressive volume + auto-boosts. */
  mayhem: boolean;
  /** Split creator fees to a second wallet. */
  feeSplit: boolean;
  feeSplitWallet: string;
  feeSplitPct: number;
  /** Deploy dev-buy spread across multiple wallets (organic look). */
  multi: boolean;
  multiWallets: number;
  /** Jito-bundle the dev buy at launch (anti-snipe). */
  bundle: boolean;
  bundleWallets: number;
};

export const DEFAULT_LAUNCH_FEATURES: LaunchFeatures = {
  cashback: true,
  tasks: false,
  mayhem: false,
  feeSplit: false,
  feeSplitWallet: '',
  feeSplitPct: 50,
  multi: false,
  multiWallets: 3,
  bundle: false,
  bundleWallets: 4,
};

export type LaunchModalDraft = {
  tweetSubject: string;
  tweetText: string;
  authorHandle: string;
  tweetUrl: string | null;
  imageUrls: string[];
  name: string;
  symbol: string;
  description: string;
  launchpad: LaunchPackageLaunchpad;
  imageStrategy: LaunchImageStrategy;
  launchBuySol: number;
  confidence: number;
  reasoning: string;
  website?: string;
  twitterUrl?: string;
  /** Advanced deploy features (defaults applied in the modal when absent). */
  features?: LaunchFeatures;
  /** When opened from a suggestion's N/T badge — which field to focus for editing. */
  focusField?: 'name' | 'ticker' | null;
};

type LaunchModalState = {
  open: boolean;
  draft: LaunchModalDraft | null;
  openWithDraft: (draft: LaunchModalDraft) => void;
  patchDraft: (patch: Partial<LaunchModalDraft>) => void;
  close: () => void;
};

export const useLaunchModalStore = create<LaunchModalState>((set) => ({
  open: false,
  draft: null,
  openWithDraft: (draft) => set({ open: true, draft }),
  patchDraft: (patch) =>
    set((s) => (s.draft ? { draft: { ...s.draft, ...patch } } : s)),
  close: () => set({ open: false, draft: null }),
}));
