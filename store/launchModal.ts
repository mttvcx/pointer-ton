'use client';

import { create } from 'zustand';
import type { LaunchImageStrategy, LaunchPackageLaunchpad } from '@/lib/launch/types';

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
