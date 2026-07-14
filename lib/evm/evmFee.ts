import type { EvmTradeChain } from '@/lib/evm/evmTradeChains';
import { isLifiChain } from '@/lib/evm/evmTradeChains';

/**
 * EVM trading fee economics.
 *
 * Pointer charges **1.5%** on EVM swaps (vs 1% on SOL/TON) — but the trader keeps
 * the SAME absolute deal as SOL: cashback = 0.5% of the trade, referral = 0.3%.
 * That's achieved WITHOUT touching the shared 50%/30% cashback/referral shares:
 * we charge 1.5% on-chain (LiFi integrator fee → the Pointer fee wallet), but feed
 * the accrual functions a **1%-equivalent basis** ({@link EVM_CASHBACK_BASIS_BPS}),
 * so the global 50%/30% shares produce exactly 0.5% / 0.3% — matching SOL/TON.
 * Net: identical rebate to users; Pointer keeps the extra 0.5% spread on EVM.
 *
 * SAFETY: the fee only turns on when BOTH `POINTER_EVM_FEE_ENABLED=1` AND
 * `POINTER_EVM_FEE_WALLET` are set. Until then EVM charges nothing and pays no
 * cashback (fail-safe — we never rebate a fee that wasn't collected). Only the
 * LiFi chains (eth/bnb/base) can take a one-tx integrator fee; Robinhood swaps go
 * direct through Uniswap (no aggregator fee hook) so they stay fee-free for now.
 */

/** Pointer's on-chain EVM fee, charged via the LiFi integrator fee (basis points). */
export const EVM_FEE_BPS = 150; // 1.5%

/**
 * Fee-basis (bps) handed to the cashback/referral accrual functions. Deliberately
 * 100 (1%) — NOT the 150 actually charged — so the existing global 50%/30% shares
 * rebate 0.5% / 0.3% of the trade, identical to SOL/TON. See file header.
 */
export const EVM_CASHBACK_BASIS_BPS = 100; // 1% → cashback 0.5%, referral 0.3% via the 50%/30% shares

const HEX40 = /^0x[a-fA-F0-9]{40}$/;

/** The Pointer EVM fee wallet (LiFi integrator payouts land here). Null if unset/invalid. */
export function evmFeeWallet(): string | null {
  const raw = process.env.POINTER_EVM_FEE_WALLET?.trim();
  if (!raw || !HEX40.test(raw)) return null;
  return raw;
}

/**
 * Is the EVM fee live? Requires the explicit enable flag AND a valid fee wallet.
 * Both default OFF → EVM stays 0-fee / no-cashback until the owner opts in
 * (after registering the "pointer" integrator + fee wallet with LiFi).
 */
export function isEvmFeeEnabled(): boolean {
  return process.env.POINTER_EVM_FEE_ENABLED === '1' && evmFeeWallet() !== null;
}

/** Does this chain actually collect the fee? Only the LiFi chains, and only when enabled. */
export function evmFeeActiveForChain(chain: EvmTradeChain): boolean {
  return isEvmFeeEnabled() && isLifiChain(chain);
}

/** LiFi `fee` param as a decimal fraction (e.g. 0.015), or 0 when the fee is off. */
export function evmFeeFractionForChain(chain: EvmTradeChain): number {
  return evmFeeActiveForChain(chain) ? EVM_FEE_BPS / 10_000 : 0;
}
