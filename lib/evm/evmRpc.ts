'use client';

import { createPublicClient, http, fallback } from 'viem';
import { EVM_VIEM_CHAIN, type EvmTradeChain } from '@/lib/evm/evmTradeChains';

/**
 * Reliable, CORS-enabled public RPCs per EVM chain for client-side reads AND
 * receipt-waiting. viem's default `http()` points at flaky endpoints (e.g.
 * cloudflare-eth), which would rate-limit and make `waitForTransactionReceipt`
 * hang for minutes. A `fallback` across solid providers keeps things snappy.
 */
export const EVM_CLIENT_RPCS: Record<EvmTradeChain, string[]> = {
  eth: ['https://ethereum-rpc.publicnode.com', 'https://eth.drpc.org', 'https://rpc.ankr.com/eth'],
  bnb: ['https://bsc-rpc.publicnode.com', 'https://bsc.drpc.org'],
  base: ['https://base-rpc.publicnode.com', 'https://base.drpc.org'],
  robinhood: ['https://rpc.mainnet.chain.robinhood.com'],
};

/** Public client on reliable fallback RPCs (never viem's flaky default). */
export function evmPublicClient(chain: EvmTradeChain) {
  return createPublicClient({
    chain: EVM_VIEM_CHAIN[chain],
    transport: fallback(EVM_CLIENT_RPCS[chain].map((u) => http(u))),
  });
}
