'use client';

import { createPublicClient, http } from 'viem';
import { ERC20_ABI, EVM_VIEM_CHAIN, type EvmTradeChain } from '@/lib/evm/evmTradeChains';

/**
 * Read an ERC-20 token balance (raw base units) for an owner on an EVM trade
 * chain. Read-only via the chain's public RPC — used to size EVM sells (there's
 * no Solana-style /api/trade/balance for EVM). Returns '0' on any failure.
 */
export async function readEvmTokenBalanceRaw(
  chain: EvmTradeChain,
  token: string,
  owner: string,
): Promise<string> {
  const HEX40 = /^0x[a-fA-F0-9]{40}$/;
  if (!HEX40.test(token) || !HEX40.test(owner)) return '0';
  try {
    const client = createPublicClient({ chain: EVM_VIEM_CHAIN[chain], transport: http() });
    const bal = (await client.readContract({
      address: token as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [owner as `0x${string}`],
    })) as bigint;
    return bal.toString();
  } catch {
    return '0';
  }
}
