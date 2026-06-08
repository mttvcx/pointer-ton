'use client';

import { useMemo } from 'react';
import { useSandboxLedger } from '@/lib/sandbox/ledger';
import { sandboxMarket } from '@/lib/sandbox/market';
import type { SandboxPosition } from '@/lib/sandbox/types';

export interface SandboxPositionView extends SandboxPosition {
  priceSol: number;
  valueSol: number;
  unrealizedPnlSol: number;
}

/**
 * Read-side hook for sandbox wallet state: balances, sub-wallets, positions
 * with live (simulated) unrealized PnL. UI-only — no live calls.
 */
export function useSandboxWallet() {
  const wallets = useSandboxLedger((s) => s.wallets);
  const activeWalletId = useSandboxLedger((s) => s.activeWalletId);
  const positions = useSandboxLedger((s) => s.positions);
  const championship = useSandboxLedger((s) => s.championship);
  const setActiveWallet = useSandboxLedger((s) => s.setActiveWallet);
  const createSubWallet = useSandboxLedger((s) => s.createSubWallet);
  const allocateToWallet = useSandboxLedger((s) => s.allocateToWallet);
  const reset = useSandboxLedger((s) => s.reset);

  const active = useMemo(
    () => wallets.find((w) => w.id === activeWalletId) ?? wallets[0] ?? null,
    [wallets, activeWalletId],
  );

  const activePositions = useMemo<SandboxPositionView[]>(() => {
    if (!active) return [];
    return positions
      .filter((p) => p.walletId === active.id)
      .map((p) => {
        const priceSol = sandboxMarket().priceFor(p.mint);
        const valueSol = p.amount * priceSol;
        return {
          ...p,
          priceSol,
          valueSol,
          unrealizedPnlSol: valueSol - p.costBasisSol,
        };
      });
  }, [positions, active]);

  const totals = useMemo(() => {
    const positionsValueSol = activePositions.reduce((s, p) => s + p.valueSol, 0);
    const unrealizedPnlSol = activePositions.reduce((s, p) => s + p.unrealizedPnlSol, 0);
    const solBalance = active?.solBalance ?? 0;
    return {
      solBalance,
      usdcBalance: active?.usdcBalance ?? 0,
      positionsValueSol,
      equitySol: solBalance + positionsValueSol,
      unrealizedPnlSol,
      realizedPnlSol: championship.realizedPnlSol,
    };
  }, [activePositions, active, championship.realizedPnlSol]);

  return {
    wallets,
    activeWallet: active,
    activePositions,
    totals,
    championship,
    setActiveWallet,
    createSubWallet,
    allocateToWallet,
    reset,
  };
}
