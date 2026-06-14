import { create } from 'zustand';

/**
 * Ensures only one Twitter profile HoverCard is open at a time across Pulse
 * rows, @handle links, and token-header icons. Opening a new trigger instantly
 * dismisses any other profile card still animating out.
 */
type TwitterProfileHoverState = {
  activeTriggerId: string | null;
  claim: (id: string) => void;
  release: (id: string) => void;
};

export const useTwitterProfileHoverStore = create<TwitterProfileHoverState>((set, get) => ({
  activeTriggerId: null,
  claim: (id) => set({ activeTriggerId: id }),
  release: (id) => {
    if (get().activeTriggerId === id) set({ activeTriggerId: null });
  },
}));
