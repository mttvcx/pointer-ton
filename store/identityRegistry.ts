'use client';

import { create } from 'zustand';

/**
 * Bumps whenever the client identity registry is (re)hydrated with the full
 * server KOL directory. Label components read `version` in their memo deps so
 * they re-resolve once the 2k+ KOLs land (the registry itself is a plain module
 * map with no built-in reactivity).
 */
type IdentityRegistryState = {
  version: number;
  hydrated: boolean;
  bump: () => void;
};

export const useIdentityRegistryStore = create<IdentityRegistryState>((set) => ({
  version: 0,
  hydrated: false,
  bump: () => set((s) => ({ version: s.version + 1, hydrated: true })),
}));
