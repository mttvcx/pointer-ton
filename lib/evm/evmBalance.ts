'use client';

import { createPublicClient, http, fallback } from 'viem';
import { ERC20_ABI, EVM_VIEM_CHAIN, type EvmTradeChain } from '@/lib/evm/evmTradeChains';

/**
 * Reliable, CORS-enabled public RPCs per EVM chain, used client-side for balance
 * reads. viem's default `http()` points at flaky endpoints (e.g. cloudflare-eth),
 * which would intermittently read balances as 0 — so we use a `fallback` across a
 * couple of solid public providers.
 */
const CLIENT_RPCS: Record<EvmTradeChain, string[]> = {
  eth: ['https://ethereum-rpc.publicnode.com', 'https://eth.drpc.org', 'https://rpc.ankr.com/eth'],
  bnb: ['https://bsc-rpc.publicnode.com', 'https://bsc.drpc.org'],
  base: ['https://base-rpc.publicnode.com', 'https://base.drpc.org'],
  robinhood: ['https://rpc.mainnet.chain.robinhood.com'],
};

function client(chain: EvmTradeChain) {
  return createPublicClient({
    chain: EVM_VIEM_CHAIN[chain],
    transport: fallback(CLIENT_RPCS[chain].map((u) => http(u))),
  });
}

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
