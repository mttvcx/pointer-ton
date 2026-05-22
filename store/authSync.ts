'use client';

import { create } from 'zustand';

type AuthSyncState = {
  /** True once Privy user row exists in Supabase (or no Privy session). */
  backendReady: boolean;
  syncing: boolean;
  lastError: string | null;
  setBackendReady: (ready: boolean) => void;
  setSyncing: (syncing: boolean) => void;
  setLastError: (error: string | null) => void;
  reset: () => void;
};

export const useAuthSyncStore = create<AuthSyncState>((set) => ({
  backendReady: false,
  syncing: false,
  lastError: null,
  setBackendReady: (backendReady) => set({ backendReady }),
  setSyncing: (syncing) => set({ syncing }),
  setLastError: (lastError) => set({ lastError }),
  reset: () => set({ backendReady: false, syncing: false, lastError: null }),
}));
