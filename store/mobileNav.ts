import { create } from 'zustand';

/**
 * Shared open-state for the mobile ☰ drawer. Triggered from the top-bar
 * hamburger and the bottom-nav "More" tab; rendered once at the shell level.
 */
interface MobileNavState {
  drawerOpen: boolean;
  setDrawerOpen: (v: boolean) => void;
}

export const useMobileNavStore = create<MobileNavState>((set) => ({
  drawerOpen: false,
  setDrawerOpen: (v) => set({ drawerOpen: v }),
}));
