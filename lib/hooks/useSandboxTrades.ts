'use client';

import { useCallback } from 'react';
import { toast } from 'sonner';
import { useSandboxLedger } from '@/lib/sandbox/ledger';
import { sandboxMarket } from '@/lib/sandbox/market';
import {
  sandboxBuy,
  sandboxSellPct,
  sandboxSellTokens,
  type SandboxTradeOutcome,
} from '@/lib/sandbox/trade';

/**
 * Sandbox trade actions for UI surfaces. Thin wrappers over the pure trade
 * helpers + ledger; show SANDBOX-labeled toasts. Never touches live routes.
 */
export function useSandboxTrades() {
  const trades = useSandboxLedger((s) => s.trades);
  const txs = useSandboxLedger((s) => s.txs);

  const buy = useCallback((mint: string, symbol: string, amountSol: number): SandboxTradeOutcome => {
    const res = sandboxBuy({ mint, symbol, amountSol });
    if (res.ok) {
      toast.success('SANDBOX buy filled', {
        description: `${symbol} · ${res.tx.hash.slice(0, 18)}… · fake fill`,
      });
    } else {
      toast.error('SANDBOX buy failed', { description: res.error });
    }
    return res;
  }, []);

  const sellPct = useCallback((mint: string, symbol: string, pct: number): SandboxTradeOutcome => {
    const res = sandboxSellPct({ mint, symbol, pct });
    if (res.ok) {
      toast.success('SANDBOX sell filled', {
        description: `${symbol} · PnL ${res.realizedPnlSol >= 0 ? '+' : ''}${res.realizedPnlSol.toFixed(4)} SOL`,
      });
    } else {
      toast.error('SANDBOX sell failed', { description: res.error });
    }
    return res;
  }, []);

  return {
    buy,
    sellPct,
    sellTokens: sandboxSellTokens,
    priceFor: (mint: string) => sandboxMarket().priceFor(mint),
    trades,
    txs,
  };
}
