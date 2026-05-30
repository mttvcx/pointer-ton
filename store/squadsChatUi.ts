'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Demo squad slugs the user can pin/reorder in chat. */
export const SQUAD_CHAT_SLUGS = ['archon-desk', 'perimeter-hl', 'ton-signal'] as const;

export type SquadChatSlug = (typeof SQUAD_CHAT_SLUGS)[number];

const DEFAULT_ORDER: SquadChatSlug[] = [...SQUAD_CHAT_SLUGS];

function normalizeOrder(order: string[] | undefined): SquadChatSlug[] {
  const base = order?.length ? [...order] : [...DEFAULT_ORDER];
  const set = new Set(base);
  for (const slug of SQUAD_CHAT_SLUGS) {
    if (!set.has(slug)) base.push(slug);
  }
  return base.filter(
    (slug, i): slug is SquadChatSlug =>
      (SQUAD_CHAT_SLUGS as readonly string[]).includes(slug) && base.indexOf(slug) === i,
  );
}

type SquadsChatUiState = {
  squadOrder: SquadChatSlug[];
  showAlertsFeed: boolean;
  showActivityFeed: boolean;
  setSquadOrder: (order: SquadChatSlug[]) => void;
  moveSquad: (from: number, to: number) => void;
  setShowAlertsFeed: (on: boolean) => void;
  setShowActivityFeed: (on: boolean) => void;
  resetSquadOrder: () => void;
};

export function normalizeSquadOrder(order: string[] | undefined): SquadChatSlug[] {
  return normalizeOrder(order);
}

export const useSquadsChatUiStore = create<SquadsChatUiState>()(
  persist(
    (set, get) => ({
      squadOrder: [...DEFAULT_ORDER],
      showAlertsFeed: false,
      showActivityFeed: false,
      setSquadOrder: (squadOrder) => set({ squadOrder: normalizeOrder(squadOrder) }),
      moveSquad: (from, to) => {
        const order = [...get().squadOrder];
        if (from < 0 || from >= order.length || to < 0 || to >= order.length) return;
        const [item] = order.splice(from, 1);
        if (!item) return;
        order.splice(to, 0, item);
        set({ squadOrder: order });
      },
      setShowAlertsFeed: (showAlertsFeed) => set({ showAlertsFeed }),
      setShowActivityFeed: (showActivityFeed) => set({ showActivityFeed }),
      resetSquadOrder: () => set({ squadOrder: [...DEFAULT_ORDER] }),
    }),
    {
      name: 'pointer-squads-chat-ui',
      version: 1,
      partialize: (s) => ({
        squadOrder: s.squadOrder,
        showAlertsFeed: s.showAlertsFeed,
        showActivityFeed: s.showActivityFeed,
      }),
      merge: (persisted, current) => {
        const p = persisted as Partial<SquadsChatUiState> | undefined;
        return {
          ...current,
          ...p,
          squadOrder: normalizeOrder(p?.squadOrder),
        };
      },
    },
  ),
);
