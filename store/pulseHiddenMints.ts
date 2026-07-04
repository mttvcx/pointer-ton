'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Blacklist rule types (mirrors Axiom's funding-wallet update). */
export type BlacklistKind = 'dev' | 'ca' | 'funder' | 'keyword' | 'website' | 'twitter' | 'kol';

type PulseHiddenMintsState = {
  /** Single mint hidden from Pulse (Contract address / Hide token). */
  mints: string[];
  /** Creator wallets blacklisted (Developer address). */
  blacklistedDevs: string[];
  /** Dev funding wallets — hide tokens whose dev was funded by these. */
  blacklistedFunders: string[];
  /** Normalized X handles without @ (token's Twitter profile). */
  blacklistedTwitter: string[];
  /** Normalized KOL handles without @ (caller/KOL). */
  blacklistedKol: string[];
  /** Lowercased name/symbol/description keywords. */
  blacklistedKeywords: string[];
  /** Normalized website domains. */
  blacklistedWebsites: string[];
  /** Cache: creator wallet → its funding wallet (or null = none/unknown). Persisted
   * so funder resolution (a Helius call) only happens once per creator. */
  creatorFunders: Record<string, string | null>;
  /** When true, hidden mints appear in Pulse columns. */
  showHiddenTokens: boolean;
  /** TODO Phase 2: unhide hidden tokens when a pair migrates. */
  unhideOnMigration: boolean;
  hideToken: (mint: string) => void;
  unhideToken: (mint: string) => void;
  blacklistDev: (wallet: string) => void;
  unblacklistDev: (wallet: string) => void;
  blacklistFunder: (wallet: string) => void;
  unblacklistFunder: (wallet: string) => void;
  blacklistTwitter: (handle: string) => void;
  unblacklistTwitter: (handle: string) => void;
  blacklistKol: (handle: string) => void;
  unblacklistKol: (handle: string) => void;
  blacklistKeyword: (word: string) => void;
  unblacklistKeyword: (word: string) => void;
  blacklistWebsite: (site: string) => void;
  unblacklistWebsite: (site: string) => void;
  setCreatorFunder: (creator: string, funder: string | null) => void;
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

/** Reduce a URL/string to a bare lowercase domain for matching. */
export function normalizeWebsiteDomain(raw: string | null | undefined): string {
  let s = (raw ?? '').trim().toLowerCase();
  if (!s) return '';
  s = s.replace(/^https?:\/\//, '').replace(/^www\./, '');
  s = s.split('/')[0]!.split('?')[0]!.split('#')[0]!;
  return s;
}

function normKeyword(word: string): string {
  return word.trim().toLowerCase();
}

export const usePulseHiddenMintsStore = create<PulseHiddenMintsState>()(
  persist(
    (set) => ({
      mints: [],
      blacklistedDevs: [],
      blacklistedFunders: [],
      blacklistedTwitter: [],
      blacklistedKol: [],
      blacklistedKeywords: [],
      blacklistedWebsites: [],
      creatorFunders: {},
      showHiddenTokens: false,
      unhideOnMigration: false,
      hideToken: (mint) => set((s) => ({ mints: uniqPush(s.mints ?? [], mint) })),
      unhideToken: (mint) =>
        set((s) => ({ mints: (s.mints ?? []).filter((m) => m !== mint.trim()) })),
      blacklistDev: (wallet) =>
        set((s) => ({ blacklistedDevs: uniqPush(s.blacklistedDevs ?? [], wallet.trim()) })),
      unblacklistDev: (wallet) =>
        set((s) => ({ blacklistedDevs: (s.blacklistedDevs ?? []).filter((w) => w !== wallet.trim()) })),
      blacklistFunder: (wallet) =>
        set((s) => ({ blacklistedFunders: uniqPush(s.blacklistedFunders ?? [], wallet.trim()) })),
      unblacklistFunder: (wallet) =>
        set((s) => ({ blacklistedFunders: (s.blacklistedFunders ?? []).filter((w) => w !== wallet.trim()) })),
      blacklistTwitter: (handle) =>
        set((s) => ({ blacklistedTwitter: uniqPush(s.blacklistedTwitter ?? [], normTwitterHandle(handle)) })),
      unblacklistTwitter: (handle) => {
        const h = normTwitterHandle(handle);
        set((s) => ({ blacklistedTwitter: (s.blacklistedTwitter ?? []).filter((x) => x !== h) }));
      },
      blacklistKol: (handle) =>
        set((s) => ({ blacklistedKol: uniqPush(s.blacklistedKol ?? [], normTwitterHandle(handle)) })),
      unblacklistKol: (handle) => {
        const h = normTwitterHandle(handle);
        set((s) => ({ blacklistedKol: (s.blacklistedKol ?? []).filter((x) => x !== h) }));
      },
      blacklistKeyword: (word) =>
        set((s) => ({ blacklistedKeywords: uniqPush(s.blacklistedKeywords ?? [], normKeyword(word)) })),
      unblacklistKeyword: (word) => {
        const w = normKeyword(word);
        set((s) => ({ blacklistedKeywords: (s.blacklistedKeywords ?? []).filter((x) => x !== w) }));
      },
      blacklistWebsite: (site) =>
        set((s) => ({ blacklistedWebsites: uniqPush(s.blacklistedWebsites ?? [], normalizeWebsiteDomain(site)) })),
      unblacklistWebsite: (site) => {
        const d = normalizeWebsiteDomain(site);
        set((s) => ({ blacklistedWebsites: (s.blacklistedWebsites ?? []).filter((x) => x !== d) }));
      },
      setCreatorFunder: (creator, funder) =>
        set((s) => ({ creatorFunders: { ...(s.creatorFunders ?? {}), [creator]: funder } })),
      setShowHiddenTokens: (show) => set({ showHiddenTokens: show }),
      setUnhideOnMigration: (on) => set({ unhideOnMigration: on }),
      clearHiddenMints: () => set({ mints: [] }),
      clearBlacklists: () =>
        set({
          blacklistedDevs: [],
          blacklistedFunders: [],
          blacklistedTwitter: [],
          blacklistedKol: [],
          blacklistedKeywords: [],
          blacklistedWebsites: [],
        }),
    }),
    {
      name: 'pointer-pulse-hidden-mints',
      version: 4,
      merge: (persisted, current) => {
        const p = persisted as Partial<PulseHiddenMintsState> | undefined;
        const arr = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : []);
        return {
          ...current,
          mints: arr(p?.mints),
          blacklistedDevs: arr(p?.blacklistedDevs),
          blacklistedFunders: arr(p?.blacklistedFunders),
          blacklistedTwitter: arr(p?.blacklistedTwitter),
          blacklistedKol: arr(p?.blacklistedKol),
          blacklistedKeywords: arr(p?.blacklistedKeywords),
          blacklistedWebsites: arr(p?.blacklistedWebsites),
          creatorFunders:
            p?.creatorFunders && typeof p.creatorFunders === 'object' ? p.creatorFunders : {},
          showHiddenTokens: typeof p?.showHiddenTokens === 'boolean' ? p.showHiddenTokens : false,
          unhideOnMigration: typeof p?.unhideOnMigration === 'boolean' ? p.unhideOnMigration : false,
        };
      },
      migrate: (persisted: unknown) => {
        if (!persisted || typeof persisted !== 'object') return persisted;
        const p = persisted as Record<string, unknown>;
        const arr = (v: unknown, fallback?: unknown): string[] =>
          Array.isArray(v) ? (v as string[]) : Array.isArray(fallback) ? (fallback as string[]) : [];
        return {
          mints: arr(p.mints),
          blacklistedDevs: arr(p.blacklistedDevs, p.hiddenCreators),
          blacklistedFunders: arr(p.blacklistedFunders),
          blacklistedTwitter: arr(p.blacklistedTwitter),
          blacklistedKol: arr(p.blacklistedKol),
          blacklistedKeywords: arr(p.blacklistedKeywords),
          blacklistedWebsites: arr(p.blacklistedWebsites),
          creatorFunders:
            p.creatorFunders && typeof p.creatorFunders === 'object' ? p.creatorFunders : {},
          showHiddenTokens: typeof p.showHiddenTokens === 'boolean' ? p.showHiddenTokens : false,
          unhideOnMigration: typeof p.unhideOnMigration === 'boolean' ? p.unhideOnMigration : false,
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
