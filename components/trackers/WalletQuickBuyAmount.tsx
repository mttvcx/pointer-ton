'use client';

import { Zap } from 'lucide-react';
import { useWalletQuickBuyStore } from '@/store/walletQuickBuy';

/**
 * Inline quick-buy amount for the trades feed — click in and type the SOL amount
 * with your keyboard (same behavior as the Pulse column quick-buy, no popup).
 */
export function WalletQuickBuyAmount() {
  const amountSol = useWalletQuickBuyStore((s) => s.amountSol);
  const setAmount = useWalletQuickBuyStore((s) => s.setAmount);

  return (
    <label
      data-no-drag
      data-wqb
      title="Quick-buy amount (SOL)"
      className="flex h-[26px] shrink-0 cursor-text items-center gap-1 rounded-md border border-accent-primary/30 bg-accent-primary/[0.1] px-2 text-accent-primary transition-colors focus-within:border-accent-primary/60 hover:bg-accent-primary/[0.18]"
    >
      <Zap className="h-3 w-3 shrink-0" strokeWidth={2.5} aria-hidden />
      <input
        type="number"
        inputMode="decimal"
        step="0.1"
        min={0}
        value={Number.isFinite(amountSol) ? amountSol : 0}
        onChange={(e) => {
          const n = Number(e.target.value);
          setAmount(Number.isFinite(n) && n >= 0 ? n : 0);
        }}
        onFocus={(e) => e.currentTarget.select()}
        aria-label="Quick-buy amount in SOL"
        className="w-10 min-w-0 bg-transparent text-[11px] font-bold tabular-nums text-accent-primary outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
    </label>
  );
}
