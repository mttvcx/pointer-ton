'use client';

/**
 * Pointer Sandbox Mode v1 — single trade entry point.
 *
 * Both sandbox UI hooks AND the live-trade hook interception funnel through
 * here. It reads a simulated price and applies the fake ledger. It performs NO
 * network I/O and imports NO live trading modules.
 */

import { useSandboxLedger } from '@/lib/sandbox/ledger';
import { sandboxMarket } from '@/lib/sandbox/market';
import type { SandboxTx } from '@/lib/sandbox/types';

export type SandboxTradeOutcome =
  | { ok: true; tx: SandboxTx; realizedPnlSol: number }
  | { ok: false; error: string };

function symbolForMint(mint: string, fallback?: string): string {
  const t = sandboxMarket().getToken(mint);
  if (t) return t.symbol;
  if (fallback) return fallback;
  return mint.slice(0, 4).toUpperCase();
}

export function sandboxBuy(args: {
  mint: string;
  symbol?: string;
  amountSol: number;
  source?: 'manual' | 'autobuy' | 'pack';
}): SandboxTradeOutcome {
  const priceSol = sandboxMarket().priceFor(args.mint);
  const symbol = symbolForMint(args.mint, args.symbol);
  const res = useSandboxLedger.getState().buy({
    mint: args.mint,
    symbol,
    amountSol: args.amountSol,
    priceSol,
    source: args.source ?? 'manual',
  });
  if (!res.ok) return res;
  return { ok: true, tx: res.tx, realizedPnlSol: 0 };
}

export function sandboxSellTokens(args: {
  mint: string;
  symbol?: string;
  amountToken: number;
  source?: 'manual' | 'autobuy' | 'pack';
}): SandboxTradeOutcome {
  const priceSol = sandboxMarket().priceFor(args.mint);
  const symbol = symbolForMint(args.mint, args.symbol);
  const res = useSandboxLedger.getState().sell({
    mint: args.mint,
    symbol,
    amountToken: args.amountToken,
    priceSol,
    source: args.source ?? 'manual',
  });
  if (!res.ok) return res;
  return { ok: true, tx: res.tx, realizedPnlSol: res.realizedPnlSol };
}

export function sandboxSellSolOut(args: {
  mint: string;
  symbol?: string;
  amountSolOut: number;
}): SandboxTradeOutcome {
  const priceSol = sandboxMarket().priceFor(args.mint);
  if (priceSol <= 0) return { ok: false, error: 'invalid_price' };
  const amountToken = args.amountSolOut / priceSol;
  return sandboxSellTokens({ mint: args.mint, symbol: args.symbol, amountToken });
}

export function sandboxSellPct(args: {
  mint: string;
  symbol?: string;
  pct: number;
}): SandboxTradeOutcome {
  const state = useSandboxLedger.getState();
  const wallet = state.wallets.find((w) => w.id === state.activeWalletId);
  const pos = state.positions.find((p) => p.mint === args.mint && p.walletId === wallet?.id);
  if (!pos || pos.amount <= 0) return { ok: false, error: 'no_sandbox_position' };
  const amountToken = (pos.amount * Math.min(Math.max(args.pct, 0), 100)) / 100;
  return sandboxSellTokens({ mint: args.mint, symbol: args.symbol, amountToken });
}
