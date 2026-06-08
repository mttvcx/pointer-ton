/**
 * Pointer Sandbox Mode v1 — pure trade executor.
 *
 * PURE + OFFLINE BY CONSTRUCTION. This module:
 *   - performs NO network I/O (no fetch, no RPC, no signing)
 *   - imports NO live modules (db, points, referrals, solana, privy, jupiter)
 *   - returns plain data the ledger applies locally
 *
 * The boundary test asserts these invariants.
 */

import type { SandboxPosition, SandboxTx, SandboxTrade } from '@/lib/sandbox/types';

/** Default sandbox platform fee (kept separate from live `getFeeBpsForUser`). */
export const SANDBOX_PLATFORM_FEE_BPS = 100; // 1%

function randomId(len = 9): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  const rnd =
    typeof crypto !== 'undefined' && 'getRandomValues' in crypto
      ? Array.from(crypto.getRandomValues(new Uint8Array(len)))
      : Array.from({ length: len }, () => Math.floor(Math.random() * 256));
  for (let i = 0; i < len; i++) out += alphabet[rnd[i]! % alphabet.length];
  return out;
}

/** TX hash format: `SANDBOX_<timestamp>_<random>`. */
export function makeSandboxTxHash(now = Date.now()): string {
  return `SANDBOX_${now}_${randomId(10)}`;
}

export function isSandboxTxHash(hash: string): boolean {
  return hash.startsWith('SANDBOX_');
}

function randomLatencyMs(): number {
  return 250 + Math.floor(Math.random() * (1800 - 250));
}

function randomSlippageBps(): number {
  // Small, believable slippage 5–80 bps.
  return 5 + Math.floor(Math.random() * 75);
}

export interface SandboxBuyParams {
  walletId: string;
  mint: string;
  symbol: string;
  amountSol: number;
  priceSol: number;
  now?: number;
}

export interface SandboxSellParams {
  walletId: string;
  mint: string;
  symbol: string;
  /** Token units to sell. */
  amountToken: number;
  priceSol: number;
  /** Existing position for cost-basis / realized PnL. */
  position: SandboxPosition | null;
  now?: number;
  source?: SandboxTrade['source'];
}

export interface SandboxBuyResult {
  tx: SandboxTx;
  trade: SandboxTrade;
  /** Token units credited after fee + slippage. */
  amountToken: number;
  platformFeeSol: number;
}

export interface SandboxSellResult {
  tx: SandboxTx;
  trade: SandboxTrade;
  /** SOL credited after fee + slippage. */
  proceedsSol: number;
  realizedPnlSol: number;
  platformFeeSol: number;
}

/**
 * Simulate a buy: spend `amountSol`, apply fake platform fee + slippage, credit
 * tokens. Returns the tx + trade rows the ledger persists. Does not mutate.
 */
export function simulateBuy(params: SandboxBuyParams, source: SandboxTrade['source'] = 'manual'): SandboxBuyResult {
  const now = params.now ?? Date.now();
  const price = Math.max(params.priceSol, 1e-12);
  const slippageBps = randomSlippageBps();
  const platformFeeSol = (params.amountSol * SANDBOX_PLATFORM_FEE_BPS) / 10_000;
  const priorityFeeSol = 0.000005 + Math.random() * 0.00002;
  const spendAfterFee = Math.max(0, params.amountSol - platformFeeSol);
  // Slippage means slightly fewer tokens than the mid-price implies.
  const effPrice = price * (1 + slippageBps / 10_000);
  const amountToken = spendAfterFee / effPrice;
  const hash = makeSandboxTxHash(now);

  const tx: SandboxTx = {
    hash,
    status: 'confirmed',
    kind: source === 'autobuy' ? 'autobuy' : 'buy',
    mint: params.mint,
    symbol: params.symbol,
    walletId: params.walletId,
    amountSol: params.amountSol,
    amountToken,
    createdAt: now,
    latencyMs: randomLatencyMs(),
    priorityFeeSol,
    platformFeeSol,
    slippageBps,
    route: 'sandbox',
  };

  const trade: SandboxTrade = {
    id: `sbt_${now}_${randomId(6)}`,
    txHash: hash,
    walletId: params.walletId,
    mint: params.mint,
    symbol: params.symbol,
    side: 'buy',
    priceSol: effPrice,
    amountToken,
    amountSol: params.amountSol,
    realizedPnlSol: 0,
    platformFeeSol,
    createdAt: now,
    source,
  };

  return { tx, trade, amountToken, platformFeeSol };
}

/**
 * Simulate a sell: reduce token position, compute realized PnL vs avg cost,
 * apply fake fee + slippage, credit SOL. Does not mutate.
 */
export function simulateSell(params: SandboxSellParams): SandboxSellResult {
  const now = params.now ?? Date.now();
  const source = params.source ?? 'manual';
  const price = Math.max(params.priceSol, 1e-12);
  const slippageBps = randomSlippageBps();
  const effPrice = price * (1 - slippageBps / 10_000);
  const grossSol = params.amountToken * effPrice;
  const platformFeeSol = (grossSol * SANDBOX_PLATFORM_FEE_BPS) / 10_000;
  const priorityFeeSol = 0.000005 + Math.random() * 0.00002;
  const proceedsSol = Math.max(0, grossSol - platformFeeSol);

  const avgCost = params.position?.avgPriceSol ?? effPrice;
  const realizedPnlSol = (effPrice - avgCost) * params.amountToken - platformFeeSol;
  const hash = makeSandboxTxHash(now);

  const tx: SandboxTx = {
    hash,
    status: 'confirmed',
    kind: 'sell',
    mint: params.mint,
    symbol: params.symbol,
    walletId: params.walletId,
    amountSol: proceedsSol,
    amountToken: params.amountToken,
    createdAt: now,
    latencyMs: randomLatencyMs(),
    priorityFeeSol,
    platformFeeSol,
    slippageBps,
    route: 'sandbox',
  };

  const trade: SandboxTrade = {
    id: `sbt_${now}_${randomId(6)}`,
    txHash: hash,
    walletId: params.walletId,
    mint: params.mint,
    symbol: params.symbol,
    side: 'sell',
    priceSol: effPrice,
    amountToken: params.amountToken,
    amountSol: proceedsSol,
    realizedPnlSol,
    platformFeeSol,
    createdAt: now,
    source,
  };

  return { tx, trade, proceedsSol, realizedPnlSol, platformFeeSol };
}
