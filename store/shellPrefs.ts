'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  DEFAULT_BOTTOM_BAR_REGION,
  type BottomBarRegionId,
} from '@/lib/layout/bottomBarRegions';

export type ToastPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

type ShellPrefsState = {
  regionId: BottomBarRegionId;
  setRegionId: (id: BottomBarRegionId) => void;
  displayNotifications: boolean;
  setDisplayNotifications: (v: boolean) => void;
  transactionSounds: boolean;
  setTransactionSounds: (v: boolean) => void;
  toastPosition: ToastPosition;
  setToastPosition: (v: ToastPosition) => void;
  customFontUrl: string;
  setCustomFontUrl: (url: string) => void;
};

export const useShellPrefsStore = create<ShellPrefsState>()(
  persist(
    (set) => ({
      regionId: DEFAULT_BOTTOM_BAR_REGION,
      setRegionId: (regionId) => set({ regionId }),
      displayNotifications: true,
      setDisplayNotifications: (displayNotifications) => set({ displayNotifications }),
      transactionSounds: true,
      setTransactionSounds: (transactionSounds) => set({ transactionSounds }),
      toastPosition: 'top-center',
      setToastPosition: (toastPosition) => set({ toastPosition }),
      customFontUrl: '',
      setCustomFontUrl: (customFontUrl) => set({ customFontUrl }),
    }),
    { name: 'pointer.shellPrefs' },
  ),
);
