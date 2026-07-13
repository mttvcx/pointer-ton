import { mainnet, bsc, base, type Chain } from 'viem/chains';
import type { AppChainId } from '@/lib/chains/appChain';

/**
 * EVM spot-trade support (LiFi same-chain swaps, user's Privy wallet).
 *
 * SAFETY: this whole path is gated by a flag and ships OFF. `isEvmTradeEnabled()`
 * reads NEXT_PUBLIC_EVM_TRADE_ENABLED for the UI; the money routes independently
 * require the server flag POINTER_EVM_TRADE_ENABLED (defense in depth — the client
 * flag alone can never move funds). Robinhood is intentionally absent: LiFi/0x
 * don't index it yet, so it needs a direct-Uniswap route (a later pass).
 */

export type EvmTradeChain = 'eth' | 'bnb' | 'base';

export const EVM_TRADE_CHAINS: readonly EvmTradeChain[] = ['eth', 'bnb', 'base'];

export function isEvmTradeChain(chain: AppChainId): chain is EvmTradeChain {
  return chain === 'eth' || chain === 'bnb' || chain === 'base';
}

export const EVM_VIEM_CHAIN: Record<EvmTradeChain, Chain> = { eth: mainnet, bnb: bsc, base: base };
export const EVM_NUMERIC_CHAIN_ID: Record<EvmTradeChain, number> = { eth: 1, bnb: 56, base: 8453 };

/** Per-chain RPC (private env first, viem public default as fallback). Server-side use. */
export function evmTradeRpcUrl(chain: EvmTradeChain): string {
  const env = {
    eth: process.env.ETH_RPC_URL,
    bnb: process.env.BSC_RPC_URL,
    base: process.env.BASE_RPC_URL,
  }[chain]?.trim();
  return env || EVM_VIEM_CHAIN[chain].rpcUrls.default.http[0]!;
}

/** LiFi "native token" sentinel — used for buying with / selling to the chain's gas token (ETH/BNB). */
export const EVM_NATIVE_SENTINEL = '0x0000000000000000000000000000000000000000' as const;

export function isNativeEvmToken(addr: string): boolean {
  const a = addr.trim().toLowerCase();
  return a === EVM_NATIVE_SENTINEL || a === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
}

/** Minimal ERC-20 ABI for allowance / approve / decimals / balanceOf. */
export const ERC20_ABI = [
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'decimals',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

/** UI gate — safe to read on the client. Money still requires the server flag. */
export function isEvmTradeEnabled(): boolean {
  return process.env.NEXT_PUBLIC_EVM_TRADE_ENABLED === '1';
}

/** Convert a wei string to a native float (6dp) without Number precision loss on large wei. */
export function weiToNativeFloat(wei: string): number {
  try {
    return Number((BigInt(wei) * 1_000_000n) / 10n ** 18n) / 1e6;
  } catch {
    return 0;
  }
}
