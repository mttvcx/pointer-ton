'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type PresetSlot = 1 | 2 | 3;

/** Max wallets user can pin in instant-trade multi-select (UI / future batch). */
export const INSTANT_TRADE_WALLET_CAP = 100;

import type { SolSpendAsset } from '@/lib/trading/spendAsset';

interface TradingState {
  activePresetSlot: PresetSlot;
  setActivePresetSlot: (slot: PresetSlot) => void;
  /** Addresses toggled for multi-wallet UI; execution still uses the active wallet until batch trading exists. */
  instantTradeWalletShortlist: string[];
  toggleInstantTradeWallet: (walletAddress: string) => void;
  clearInstantTradeWalletShortlist: () => void;
  /** Compact instant-trade panel open — survives token navigation. */
  compactInstantTradeOpen: boolean;
  setCompactInstantTradeOpen: (open: boolean) => void;
  toggleCompactInstantTrade: () => void;
  /** Solana buy spend asset (SOL or USDC). */
  spendAsset: SolSpendAsset;
  setSpendAsset: (asset: SolSpendAsset) => void;
}

export const useTradingStore = create<TradingState>()(
  persist(
    (set, get) => ({
      activePresetSlot: 2,
      setActivePresetSlot: (slot) => set({ activePresetSlot: slot }),
      instantTradeWalletShortlist: [],
      toggleInstantTradeWallet: (walletAddress) =>
        set((s) => {
          const cur = s.instantTradeWalletShortlist;
          if (cur.includes(walletAddress)) {
            return { instantTradeWalletShortlist: cur.filter((a) => a !== walletAddress) };
          }
          if (cur.length >= INSTANT_TRADE_WALLET_CAP) return {};
          return { instantTradeWalletShortlist: [...cur, walletAddress] };
        }),
      clearInstantTradeWalletShortlist: () => set({ instantTradeWalletShortlist: [] }),
      compactInstantTradeOpen: false,
      setCompactInstantTradeOpen: (open) => set({ compactInstantTradeOpen: open }),
      toggleCompactInstantTrade: () =>
        set({ compactInstantTradeOpen: !get().compactInstantTradeOpen }),
      spendAsset: 'sol',
      setSpendAsset: (spendAsset) => set({ spendAsset }),
    }),
    {
      name: 'pointer-trading-preset',
      partialize: (s) => ({
        activePresetSlot: s.activePresetSlot,
        instantTradeWalletShortlist: s.instantTradeWalletShortlist,
        compactInstantTradeOpen: s.compactInstantTradeOpen,
        spendAsset: s.spendAsset,
      }),
    },
  ),
);
