'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type PulseHiddenMintsState = {
  /** Single mint hidden from Pulse (Hide token). */
  mints: string[];
  /** Creator wallets blacklisted from Pulse (Blacklist dev). */
  blacklistedDevs: string[];
  /** Normalized X handles without @ (Blacklist Twitter profile). */
  blacklistedTwitter: string[];
  /** When true, hidden mints appear in Pulse columns. */
  showHiddenTokens: boolean;
  /** TODO Phase 2: unhide hidden tokens when a pair migrates. */
  unhideOnMigration: boolean;
  hideToken: (mint: string) => void;
  unhideToken: (mint: string) => void;
  blacklistDev: (wallet: string) => void;
  unblacklistDev: (wallet: string) => void;
  blacklistTwitter: (handle: string) => void;
  unblacklistTwitter: (handle: string) => void;
  setShowHiddenTokens: (show: boolean) => void;
  setUnhideOnMigration: (on: boolean) => void;
  clearHiddenMints: () => void;
  clearBlacklists: () => void;
};

function uniqPush(list: string[], value: string): string[] {
  const v = value.trim();
  if (!v || list.includes(v)) return list;
  return [...list, v];
}

function normTwitterHandle(handle: string): string {
  return handle.trim().replace(/^@+/, '').toLowerCase();
}

export const usePulseHiddenMintsStore = create<PulseHiddenMintsState>()(
  persist(
    (set) => ({
      mints: [],
      blacklistedDevs: [],
      blacklistedTwitter: [],
      showHiddenTokens: false,
      unhideOnMigration: false,
      hideToken: (mint) => set((s) => ({ mints: uniqPush(s.mints ?? [], mint) })),
      unhideToken: (mint) =>
        set((s) => ({ mints: (s.mints ?? []).filter((m) => m !== mint.trim()) })),
      blacklistDev: (wallet) =>
        set((s) => ({ blacklistedDevs: uniqPush(s.blacklistedDevs ?? [], wallet.trim()) })),
      unblacklistDev: (wallet) =>
        set((s) => ({
          blacklistedDevs: (s.blacklistedDevs ?? []).filter((w) => w !== wallet.trim()),
        })),
      blacklistTwitter: (handle) =>
        set((s) => ({
          blacklistedTwitter: uniqPush(s.blacklistedTwitter ?? [], normTwitterHandle(handle)),
        })),
      unblacklistTwitter: (handle) => {
        const h = normTwitterHandle(handle);
        set((s) => ({
          blacklistedTwitter: (s.blacklistedTwitter ?? []).filter((x) => x !== h),
        }));
      },
      setShowHiddenTokens: (show) => set({ showHiddenTokens: show }),
      setUnhideOnMigration: (on) => set({ unhideOnMigration: on }),
      clearHiddenMints: () => set({ mints: [] }),
      clearBlacklists: () => set({ blacklistedDevs: [], blacklistedTwitter: [] }),
    }),
    {
      name: 'pointer-pulse-hidden-mints',
      version: 3,
      merge: (persisted, current) => {
        const p = persisted as Partial<PulseHiddenMintsState> | undefined;
        return {
          ...current,
          mints: Array.isArray(p?.mints) ? p.mints : [],
          blacklistedDevs: Array.isArray(p?.blacklistedDevs) ? p.blacklistedDevs : [],
          blacklistedTwitter: Array.isArray(p?.blacklistedTwitter) ? p.blacklistedTwitter : [],
          showHiddenTokens: typeof p?.showHiddenTokens === 'boolean' ? p.showHiddenTokens : false,
          unhideOnMigration: typeof p?.unhideOnMigration === 'boolean' ? p.unhideOnMigration : false,
        };
      },
      migrate: (persisted: unknown, version) => {
        if (!persisted || typeof persisted !== 'object') return persisted;
        const p = persisted as Record<string, unknown>;
        const base = {
          mints: Array.isArray(p.mints) ? p.mints : [],
          blacklistedDevs: Array.isArray(p.blacklistedDevs)
            ? p.blacklistedDevs
            : Array.isArray(p.hiddenCreators)
              ? p.hiddenCreators
              : [],
          blacklistedTwitter: Array.isArray(p.blacklistedTwitter) ? p.blacklistedTwitter : [],
        };
        if (version < 3) {
          return { ...base, showHiddenTokens: false, unhideOnMigration: false };
        }
        return base;
      },
    },
  ),
);

export function normalizePulseTwitterHandle(
  tokenHandle: string | null | undefined,
): string | null {
  if (!tokenHandle?.trim()) return null;
  const raw = tokenHandle.trim();
  if (/^https?:\/\//i.test(raw)) {
    const m = raw.match(/(?:x\.com|twitter\.com)\/([^/?#]+)/i);
    if (m?.[1] && m[1] !== 'i' && m[1] !== 'search') return normTwitterHandle(m[1]);
    return null;
  }
  const h = normTwitterHandle(raw);
  return h || null;
}
