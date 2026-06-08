'use client';

/**
 * Pointer Sandbox Mode v1 — local fake ledger (zustand + localStorage).
 *
 * Persisted ONLY to localStorage key `pointer-sandbox-v1`. Imports nothing
 * from live trading, db, points, referrals, solana, or privy. Every mutation
 * is fake and reversible via `reset()`.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  SANDBOX_LEDGER_VERSION,
  type SandboxLedgerState,
  type SandboxPosition,
  type SandboxTrade,
  type SandboxTx,
  type SandboxWallet,
  type SandboxPackOpen,
  type SandboxAutomationEvent,
} from '@/lib/sandbox/types';
import { SANDBOX_LEDGER_KEY } from '@/lib/sandbox/mode';
import { simulateBuy, simulateSell } from '@/lib/sandbox/executor';

const STARTING_SOL = 100;
const STARTING_USDC = 5000;
const MAX_HISTORY = 250;

function rand(len = 8): string {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < len; i++) s += a[Math.floor(Math.random() * a.length)];
  return s;
}

function fakeAddress(): string {
  return `SBXW${rand(36)}`;
}

function makePrimaryWallet(now: number): SandboxWallet {
  return {
    id: 'sbx-primary',
    address: fakeAddress(),
    label: 'Sandbox Wallet',
    isPrimary: true,
    solBalance: STARTING_SOL,
    usdcBalance: STARTING_USDC,
    createdAt: now,
  };
}

function freshState(): SandboxLedgerState {
  const now = Date.now();
  const primary = makePrimaryWallet(now);
  return {
    version: SANDBOX_LEDGER_VERSION,
    createdAt: now,
    wallets: [primary],
    activeWalletId: primary.id,
    positions: [],
    trades: [],
    txs: [],
    packOpens: [],
    automation: [],
    championship: {
      ptcs: 0,
      trades: 0,
      realizedPnlSol: 0,
      bestTradePnlSol: 0,
      updatedAt: now,
    },
  };
}

function recomputePtcs(trades: SandboxTrade[]): SandboxLedgerState['championship'] {
  const sells = trades.filter((t) => t.side === 'sell');
  const realizedPnlSol = sells.reduce((s, t) => s + t.realizedPnlSol, 0);
  const bestTradePnlSol = sells.reduce((m, t) => Math.max(m, t.realizedPnlSol), 0);
  const tradeCount = trades.length;
  // Sandbox-only PTCS heuristic — NOT the official championship formula.
  const ptcs = Math.max(0, Math.round(100 + realizedPnlSol * 12 + tradeCount * 2 + bestTradePnlSol * 6));
  return { ptcs, trades: tradeCount, realizedPnlSol, bestTradePnlSol, updatedAt: Date.now() };
}

function clampHistory<T>(arr: T[]): T[] {
  return arr.length > MAX_HISTORY ? arr.slice(0, MAX_HISTORY) : arr;
}

interface SandboxLedgerActions {
  buy: (args: { mint: string; symbol: string; amountSol: number; priceSol: number; source?: SandboxTrade['source'] }) =>
    | { ok: true; tx: SandboxTx }
    | { ok: false; error: string };
  sell: (args: { mint: string; symbol: string; amountToken: number; priceSol: number; source?: SandboxTrade['source'] }) =>
    | { ok: true; tx: SandboxTx; realizedPnlSol: number }
    | { ok: false; error: string };
  setActiveWallet: (walletId: string) => void;
  createSubWallet: (label?: string) => SandboxWallet;
  allocateToWallet: (walletId: string, amountSol: number) => { ok: boolean; error?: string };
  recordPackOpen: (open: SandboxPackOpen, costSol: number) => { ok: boolean; error?: string };
  pushAutomationEvent: (evt: Omit<SandboxAutomationEvent, 'id' | 'createdAt'>) => SandboxAutomationEvent;
  reset: () => void;
}

export type SandboxLedgerStore = SandboxLedgerState & SandboxLedgerActions;

function activeWallet(state: SandboxLedgerState): SandboxWallet | undefined {
  return state.wallets.find((w) => w.id === state.activeWalletId);
}

export const useSandboxLedger = create<SandboxLedgerStore>()(
  persist(
    (set, get) => ({
      ...freshState(),

      buy: ({ mint, symbol, amountSol, priceSol, source = 'manual' }) => {
        const state = get();
        const wallet = activeWallet(state);
        if (!wallet) return { ok: false as const, error: 'no_sandbox_wallet' };
        if (!Number.isFinite(amountSol) || amountSol <= 0) {
          return { ok: false as const, error: 'invalid_amount' };
        }
        if (amountSol > wallet.solBalance) {
          return { ok: false as const, error: 'insufficient_sandbox_sol' };
        }
        const { tx, trade, amountToken } = simulateBuy(
          { walletId: wallet.id, mint, symbol, amountSol, priceSol },
          source,
        );

        const positions = [...state.positions];
        const idx = positions.findIndex((p) => p.mint === mint && p.walletId === wallet.id);
        if (idx >= 0) {
          const prev = positions[idx]!;
          const newAmount = prev.amount + amountToken;
          const newCost = prev.costBasisSol + (amountSol - trade.platformFeeSol);
          positions[idx] = {
            ...prev,
            amount: newAmount,
            costBasisSol: newCost,
            avgPriceSol: newAmount > 0 ? newCost / newAmount : 0,
            updatedAt: tx.createdAt,
          };
        } else {
          const cost = amountSol - trade.platformFeeSol;
          positions.push({
            mint,
            symbol,
            walletId: wallet.id,
            amount: amountToken,
            avgPriceSol: amountToken > 0 ? cost / amountToken : priceSol,
            costBasisSol: cost,
            updatedAt: tx.createdAt,
          });
        }

        const wallets = state.wallets.map((w) =>
          w.id === wallet.id ? { ...w, solBalance: w.solBalance - amountSol } : w,
        );
        const trades = clampHistory([trade, ...state.trades]);
        set({
          wallets,
          positions,
          trades,
          txs: clampHistory([tx, ...state.txs]),
          championship: recomputePtcs(trades),
        });
        return { ok: true as const, tx };
      },

      sell: ({ mint, symbol, amountToken, priceSol, source = 'manual' }) => {
        const state = get();
        const wallet = activeWallet(state);
        if (!wallet) return { ok: false as const, error: 'no_sandbox_wallet' };
        const posIdx = state.positions.findIndex((p) => p.mint === mint && p.walletId === wallet.id);
        const position = posIdx >= 0 ? state.positions[posIdx]! : null;
        if (!position || position.amount <= 0) {
          return { ok: false as const, error: 'no_sandbox_position' };
        }
        const sellAmount = Math.min(amountToken, position.amount);
        if (!Number.isFinite(sellAmount) || sellAmount <= 0) {
          return { ok: false as const, error: 'invalid_amount' };
        }

        const { tx, trade, proceedsSol, realizedPnlSol } = simulateSell({
          walletId: wallet.id,
          mint,
          symbol,
          amountToken: sellAmount,
          priceSol,
          position,
          source,
        });

        const positions = [...state.positions];
        const remaining = position.amount - sellAmount;
        const soldCost = position.avgPriceSol * sellAmount;
        if (remaining <= 1e-9) {
          positions.splice(posIdx, 1);
        } else {
          positions[posIdx] = {
            ...position,
            amount: remaining,
            costBasisSol: Math.max(0, position.costBasisSol - soldCost),
            updatedAt: tx.createdAt,
          };
        }

        const wallets = state.wallets.map((w) =>
          w.id === wallet.id ? { ...w, solBalance: w.solBalance + proceedsSol } : w,
        );
        const trades = clampHistory([trade, ...state.trades]);
        set({
          wallets,
          positions,
          trades,
          txs: clampHistory([tx, ...state.txs]),
          championship: recomputePtcs(trades),
        });
        return { ok: true as const, tx, realizedPnlSol };
      },

      setActiveWallet: (walletId) => {
        if (get().wallets.some((w) => w.id === walletId)) set({ activeWalletId: walletId });
      },

      createSubWallet: (label) => {
        const now = Date.now();
        const state = get();
        const n = state.wallets.length;
        const wallet: SandboxWallet = {
          id: `sbx-${now}-${rand(4)}`,
          address: fakeAddress(),
          label: label?.trim() || `Split Wallet ${n}`,
          isPrimary: false,
          solBalance: 0,
          usdcBalance: 0,
          createdAt: now,
        };
        set({ wallets: [...state.wallets, wallet] });
        return wallet;
      },

      allocateToWallet: (walletId, amountSol) => {
        const state = get();
        const primary = state.wallets.find((w) => w.isPrimary);
        const target = state.wallets.find((w) => w.id === walletId);
        if (!primary || !target) return { ok: false, error: 'wallet_not_found' };
        if (primary.id === target.id) return { ok: false, error: 'same_wallet' };
        if (!Number.isFinite(amountSol) || amountSol <= 0) return { ok: false, error: 'invalid_amount' };
        if (amountSol > primary.solBalance) return { ok: false, error: 'insufficient_sandbox_sol' };
        set({
          wallets: state.wallets.map((w) => {
            if (w.id === primary.id) return { ...w, solBalance: w.solBalance - amountSol };
            if (w.id === target.id) return { ...w, solBalance: w.solBalance + amountSol };
            return w;
          }),
        });
        return { ok: true };
      },

      recordPackOpen: (open, costSol) => {
        const state = get();
        const wallet = activeWallet(state);
        if (!wallet) return { ok: false, error: 'no_sandbox_wallet' };
        if (costSol > wallet.solBalance) return { ok: false, error: 'insufficient_sandbox_sol' };

        // Credit token rewards into positions at their notional sandbox value.
        const positions = [...state.positions];
        for (const r of open.rewards) {
          if (!r.mint || r.valueSol <= 0) continue;
          const idx = positions.findIndex((p) => p.mint === r.mint && p.walletId === wallet.id);
          const price = 0.0001; // nominal sandbox reward price
          const amount = r.valueSol / price;
          if (idx >= 0) {
            const prev = positions[idx]!;
            const newAmount = prev.amount + amount;
            const newCost = prev.costBasisSol + r.valueSol;
            positions[idx] = {
              ...prev,
              amount: newAmount,
              costBasisSol: newCost,
              avgPriceSol: newAmount > 0 ? newCost / newAmount : price,
              updatedAt: open.createdAt,
            };
          } else {
            positions.push({
              mint: r.mint,
              symbol: r.symbol,
              walletId: wallet.id,
              amount,
              avgPriceSol: price,
              costBasisSol: r.valueSol,
              updatedAt: open.createdAt,
            });
          }
        }

        set({
          wallets: state.wallets.map((w) =>
            w.id === wallet.id ? { ...w, solBalance: w.solBalance - costSol } : w,
          ),
          positions,
          packOpens: clampHistory([open, ...state.packOpens]),
        });
        return { ok: true };
      },

      pushAutomationEvent: (evt) => {
        const full: SandboxAutomationEvent = {
          ...evt,
          id: `sbx-evt-${Date.now()}-${rand(4)}`,
          createdAt: Date.now(),
        };
        set({ automation: clampHistory([full, ...get().automation]) });
        return full;
      },

      reset: () => set({ ...freshState() }),
    }),
    {
      name: SANDBOX_LEDGER_KEY,
      version: SANDBOX_LEDGER_VERSION,
      partialize: (s) => ({
        version: s.version,
        createdAt: s.createdAt,
        wallets: s.wallets,
        activeWalletId: s.activeWalletId,
        positions: s.positions,
        trades: s.trades,
        txs: s.txs,
        packOpens: s.packOpens,
        automation: s.automation,
        championship: s.championship,
      }),
    },
  ),
);

export function sandboxActiveWallet(state: SandboxLedgerState): SandboxWallet | undefined {
  return activeWallet(state);
}
