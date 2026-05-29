'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  createWalletGroupId,
  type StoredWalletGroup,
} from '@/lib/trade/walletGroups';

interface WalletGroupsState {
  groups: StoredWalletGroup[];
  activeGroupId: string | null;

  createGroup: (label: string) => string;
  renameGroup: (id: string, label: string) => void;
  deleteGroup: (id: string) => void;
  setGroupWallets: (id: string, walletAddresses: string[]) => void;
  toggleWalletInGroup: (id: string, walletAddress: string) => void;
  touchGroup: (id: string) => void;
  setActiveGroupId: (id: string | null) => void;
}

export const useWalletGroupsStore = create<WalletGroupsState>()(
  persist(
    (set, get) => ({
      groups: [],
      activeGroupId: null,

      createGroup: (label) => {
        const trimmed = label.trim();
        const id = createWalletGroupId();
        const now = Date.now();
        set((s) => ({
          groups: [
            ...(s.groups ?? []),
            {
              id,
              label: trimmed || 'New group',
              walletAddresses: [],
              lastUsedAt: now,
              createdAt: now,
            },
          ],
          activeGroupId: id,
        }));
        return id;
      },

      renameGroup: (id, label) => {
        const trimmed = label.trim();
        if (!trimmed) return;
        set((s) => ({
          groups: (s.groups ?? []).map((g) => (g.id === id ? { ...g, label: trimmed } : g)),
        }));
      },

      deleteGroup: (id) =>
        set((s) => ({
          groups: (s.groups ?? []).filter((g) => g.id !== id),
          activeGroupId: s.activeGroupId === id ? null : s.activeGroupId,
        })),

      setGroupWallets: (id, walletAddresses) =>
        set((s) => ({
          groups: (s.groups ?? []).map((g) =>
            g.id === id ? { ...g, walletAddresses: [...new Set(walletAddresses)] } : g,
          ),
        })),

      toggleWalletInGroup: (id, walletAddress) => {
        const addr = walletAddress.trim();
        if (!addr) return;
        set((s) => ({
          groups: (s.groups ?? []).map((g) => {
            const addrs = g.walletAddresses ?? [];
            if (g.id !== id) {
              return { ...g, walletAddresses: addrs.filter((a) => a !== addr) };
            }
            const has = addrs.includes(addr);
            return {
              ...g,
              walletAddresses: has ? addrs.filter((a) => a !== addr) : [...addrs, addr],
            };
          }),
        }));
      },

      touchGroup: (id) =>
        set((s) => ({
          groups: (s.groups ?? []).map((g) => (g.id === id ? { ...g, lastUsedAt: Date.now() } : g)),
        })),

      setActiveGroupId: (id) => set({ activeGroupId: id }),
    }),
    {
      name: 'pointer-wallet-groups',
      merge: (persisted, current) => {
        const p = persisted as Partial<WalletGroupsState> | undefined;
        const groups = Array.isArray(p?.groups)
          ? p!.groups!.map((g) => ({
              ...g,
              walletAddresses: Array.isArray(g.walletAddresses) ? g.walletAddresses : [],
            }))
          : [];
        return {
          ...current,
          ...p,
          groups,
          activeGroupId: typeof p?.activeGroupId === 'string' ? p.activeGroupId : null,
        };
      },
      partialize: (s) => ({
        groups: s.groups,
        activeGroupId: s.activeGroupId,
      }),
    },
  ),
);
