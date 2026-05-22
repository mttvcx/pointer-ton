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
  hideToken: (mint: string) => void;
  blacklistDev: (wallet: string) => void;
  blacklistTwitter: (handle: string) => void;
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
      hideToken: (mint) => set((s) => ({ mints: uniqPush(s.mints, mint) })),
      blacklistDev: (wallet) =>
        set((s) => ({ blacklistedDevs: uniqPush(s.blacklistedDevs, wallet.trim()) })),
      blacklistTwitter: (handle) =>
        set((s) => ({
          blacklistedTwitter: uniqPush(s.blacklistedTwitter, normTwitterHandle(handle)),
        })),
    }),
    {
      name: 'pointer-pulse-hidden-mints',
      version: 2,
      migrate: (persisted: unknown) => {
        if (!persisted || typeof persisted !== 'object') return persisted;
        const p = persisted as Record<string, unknown>;
        return {
          mints: Array.isArray(p.mints) ? p.mints : [],
          blacklistedDevs: Array.isArray(p.blacklistedDevs)
            ? p.blacklistedDevs
            : Array.isArray(p.hiddenCreators)
              ? p.hiddenCreators
              : [],
          blacklistedTwitter: Array.isArray(p.blacklistedTwitter) ? p.blacklistedTwitter : [],
        };
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
