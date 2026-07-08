'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Sibyl Spaces — research folders, stored LOCALLY on the device (localStorage),
 * on-brand with the privacy story ("your research stays yours"). A Space holds
 * saved items (a query + Sibyl's answer). No server round-trip; nothing to leak.
 */
export type SpaceItem = { id: string; title: string; body: string; savedAt: number };
export type Space = { id: string; name: string; items: SpaceItem[] };

type State = {
  spaces: Space[];
  createSpace: (name: string) => string;
  renameSpace: (id: string, name: string) => void;
  deleteSpace: (id: string) => void;
  addItem: (spaceId: string, item: Omit<SpaceItem, 'id' | 'savedAt'>) => void;
  removeItem: (spaceId: string, itemId: string) => void;
};

let seq = 0;
const uid = (p: string) => `${p}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

export const useSibylSpaces = create<State>()(
  persist(
    (set) => ({
      spaces: [],
      createSpace: (name) => {
        const id = uid('sp');
        set((s) => ({ spaces: [...s.spaces, { id, name: name.trim() || 'Untitled', items: [] }] }));
        return id;
      },
      renameSpace: (id, name) => set((s) => ({ spaces: s.spaces.map((x) => (x.id === id ? { ...x, name: name.trim() || x.name } : x)) })),
      deleteSpace: (id) => set((s) => ({ spaces: s.spaces.filter((x) => x.id !== id) })),
      addItem: (spaceId, item) =>
        set((s) => ({
          spaces: s.spaces.map((x) =>
            x.id === spaceId ? { ...x, items: [{ ...item, id: uid('it'), savedAt: Date.now() }, ...x.items] } : x,
          ),
        })),
      removeItem: (spaceId, itemId) =>
        set((s) => ({ spaces: s.spaces.map((x) => (x.id === spaceId ? { ...x, items: x.items.filter((i) => i.id !== itemId) } : x)) })),
    }),
    { name: 'sibyl.spaces' },
  ),
);
