import { defineChain, type Chain } from 'viem';
import { mainnet, bsc, base } from 'viem/chains';
import type { AppChainId } from '@/lib/chains/appChain';

/**
 * EVM spot-trade support. eth/bnb/base swap via LiFi (aggregator); Robinhood
 * (chain 4663) swaps DIRECTLY through Uniswap V3 — LiFi/0x don't index it — but
 * produces the same normalized quote shape, so approve/swap/record are identical.
 *
 * SAFETY: this whole path is gated by a flag and ships OFF. `isEvmTradeEnabled()`
 * reads NEXT_PUBLIC_EVM_TRADE_ENABLED for the UI; the money routes independently
 * require the server flag POINTER_EVM_TRADE_ENABLED (defense in depth — the client
 * flag alone can never move funds).
 */

/** Robinhood Chain (4663) — not in viem/chains, defined here. */
export const robinhoodChain: Chain = defineChain({
  id: 4663,
  name: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.mainnet.chain.robinhood.com'] } },
  blockExplorers: { default: { name: 'Blockscout', url: 'https://robinhoodchain.blockscout.com' } },
});

export type EvmTradeChain = 'eth' | 'bnb' | 'base' | 'robinhood';

export const EVM_TRADE_CHAINS: readonly EvmTradeChain[] = ['eth', 'bnb', 'base', 'robinhood'];

export function isEvmTradeChain(chain: AppChainId): chain is EvmTradeChain {
  return chain === 'eth' || chain === 'bnb' || chain === 'base' || chain === 'robinhood';
}

/** eth/bnb/base route through LiFi; robinhood routes through direct Uniswap V3. */
export function isLifiChain(chain: EvmTradeChain): chain is 'eth' | 'bnb' | 'base' {
  return chain === 'eth' || chain === 'bnb' || chain === 'base';
}

export const EVM_VIEM_CHAIN: Record<EvmTradeChain, Chain> = {
  eth: mainnet,
  bnb: bsc,
  base: base,
  robinhood: robinhoodChain,
};
export const EVM_NUMERIC_CHAIN_ID: Record<EvmTradeChain, number> = {
  eth: 1,
  bnb: 56,
  base: 8453,
  robinhood: 4663,
};

/** Per-chain RPC (private env first, viem public default as fallback). Server-side use. */
export function evmTradeRpcUrl(chain: EvmTradeChain): string {
  const env = {
    eth: process.env.ETH_RPC_URL,
    bnb: process.env.BSC_RPC_URL,
    base: process.env.BASE_RPC_URL,
    robinhood: process.env.ROBINHOOD_RPC_URL,
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
