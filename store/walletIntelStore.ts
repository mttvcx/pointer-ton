'use client';

import { create } from 'zustand';
import type { AppChainId } from '@/lib/chains/appChain';
import type { PnlSharePayload } from '@/lib/share/types';
import {
  monthlyPnlToSharePayload,
  monthlyShareHeaderLabel,
} from '@/lib/portfolio/monthlyPnlSharePayload';
import type { MonthlyPnlSharePayload } from '@/lib/portfolio/monthlyPnlSharePayload';

export type WalletIntelOpen = {
  address: string;
  chain: AppChainId;
  /**
   * When true (e.g. opened from token Top Traders row), merge demo positions / tab rows
   * so Share PnL and Activity previews are visible withoutIndexer data.
   */
  rowDemo?: boolean;
};

export type ShareComposerKind = 'position' | 'monthly';

type State = {
  walletOpen: boolean;
  wallet: WalletIntelOpen | null;

  shareOpen: boolean;
  shareKind: ShareComposerKind;
  shareHeader: string | null;
  /** USD/SOL preference when opening from PNL calendar. */
  shareCalendarCurrency: 'usd' | 'sol' | null;
  sharePayload: PnlSharePayload | null;

  openWallet: (w: WalletIntelOpen) => void;
  closeWallet: () => void;

  openShare: (p: PnlSharePayload) => void;
  openMonthlyShare: (p: MonthlyPnlSharePayload) => void;
  closeShare: () => void;
};

export const useWalletIntelStore = create<State>((set) => ({
  walletOpen: false,
  wallet: null,

  shareOpen: false,
  shareKind: 'position',
  shareHeader: null,
  shareCalendarCurrency: null,
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
      shareKind: 'position',
      shareHeader: null,
      shareCalendarCurrency: null,
      sharePayload: null,
    }),

  openShare: (p) =>
    set({
      shareOpen: true,
      shareKind: 'position',
      shareHeader: null,
      shareCalendarCurrency: null,
      sharePayload: p,
    }),

  openMonthlyShare: (p) =>
    set({
      shareOpen: true,
      shareKind: 'monthly',
      shareHeader: monthlyShareHeaderLabel(p.year, p.month),
      shareCalendarCurrency: p.currency,
      sharePayload: monthlyPnlToSharePayload(p),
    }),

  closeShare: () =>
    set({
      shareOpen: false,
      shareKind: 'position',
      shareHeader: null,
      shareCalendarCurrency: null,
      sharePayload: null,
    }),
}));
