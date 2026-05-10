'use client';

import { create } from 'zustand';
import type { AppChainId } from '@/lib/chains/appChain';
import type { PnlSharePayload } from '@/lib/share/types';

export type WalletIntelOpen = {
  address: string;
  chain: AppChainId;
};

type State = {
  walletOpen: boolean;
  wallet: WalletIntelOpen | null;

  shareOpen: boolean;
  sharePayload: PnlSharePayload | null;

  openWallet: (w: WalletIntelOpen) => void;
  closeWallet: () => void;

  openShare: (p: PnlSharePayload) => void;
  closeShare: () => void;
};

export const useWalletIntelStore = create<State>((set) => ({
  walletOpen: false,
  wallet: null,

  shareOpen: false,
  sharePayload: null,

  openWallet: (w) =>
    set({
      walletOpen: true,
      wallet: w,
    }),

  closeWallet: () =>
    set({
      walletOpen: false,
      wallet: null,
      shareOpen: false,
      sharePayload: null,
    }),

  openShare: (p) =>
    set({
      shareOpen: true,
      sharePayload: p,
    }),

  closeShare: () =>
    set({
      shareOpen: false,
      sharePayload: null,
    }),
}));
