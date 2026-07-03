'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type ThemeAccentPromptState = {
  /** User checked "Don't ask again" — never prompt to match the Axiom buy button. */
  dismissedForever: boolean;
  /** Dismissed this session (resets on reload) — avoids re-nagging within a session. */
  sessionDismissed: boolean;
  setDismissedForever: (v: boolean) => void;
  dismissSession: () => void;
};

export const useThemeAccentPromptStore = create<ThemeAccentPromptState>()(
  persist(
    (set) => ({
      dismissedForever: false,
      sessionDismissed: false,
      setDismissedForever: (v) => set({ dismissedForever: v }),
      dismissSession: () => set({ sessionDismissed: true }),
    }),
    {
      name: 'pointer.theme-accent-prompt',
      // Only the permanent flag persists; session dismissal is in-memory.
      partialize: (s) => ({ dismissedForever: s.dismissedForever }),
    },
  ),
);
