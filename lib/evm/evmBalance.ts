'use client';

import { ERC20_ABI, type EvmTradeChain } from '@/lib/evm/evmTradeChains';
import { evmPublicClient as client } from '@/lib/evm/evmRpc';

const HEX40 = /^0x[a-fA-F0-9]{40}$/;

/**
 * Read an ERC-20 token balance (raw base units) for an owner on an EVM trade
 * chain. Read-only via public RPCs — used to size EVM sells (there's no
 * Solana-style /api/trade/balance for EVM). Returns '0' on any failure.
 */
export async function readEvmTokenBalanceRaw(
  chain: EvmTradeChain,
  token: string,
  owner: string,
): Promise<string> {
  if (!HEX40.test(token) || !HEX40.test(owner)) return '0';
  try {
    const bal = (await client(chain).readContract({
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

/**
 * Read the NATIVE balance (ETH/BNB) for an owner on an EVM trade chain, as a
 * float in native units (e.g. 0.0106 ETH). Read-only via public RPCs. Returns 0
 * on any failure.
 */
export async function readEvmNativeBalance(chain: EvmTradeChain, owner: string): Promise<number> {
  if (!HEX40.test(owner)) return 0;
  try {
    const wei = await client(chain).getBalance({ address: owner as `0x${string}` });
    // 18-dp native → float (6dp), without Number precision loss on large wei.
    return Number((wei * 1_000_000n) / 10n ** 18n) / 1e6;
  } catch {
    return 0;
  }
}
