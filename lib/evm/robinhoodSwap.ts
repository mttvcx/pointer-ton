import 'server-only';

import { createPublicClient, http, encodeFunctionData } from 'viem';
import { robinhoodChain, evmTradeRpcUrl } from '@/lib/evm/evmTradeChains';
import type { EvmSwapQuote } from '@/lib/evm/evmSwapQuote';

/**
 * Robinhood Chain (4663) swaps go DIRECT through Uniswap V3 (LiFi/0x don't index
 * it). Addresses verified on-chain via the router's WETH9()/factory() getters.
 * Produces the same normalized EvmSwapQuote as the LiFi path, so the client
 * approve→send→confirm and the server record are identical.
 */

// Verified on chain 4663 (SwapRouter02.WETH9() / factory()).
const SWAP_ROUTER = '0xcaf681a66d020601342297493863e78c959e5cb2' as const;
const QUOTER_V2 = '0x33e885ed0ec9bf04ecfb19341582aadcb4c8a9e7' as const;
const WETH = '0x0bd7d308f8e1639fab988df18a8011f41eacad73' as const;
/** SwapRouter02 constant meaning "the router itself" (recipient for the wrap step). */
const ADDRESS_THIS = '0x0000000000000000000000000000000000000002' as const;
const FEE_TIERS = [500, 3000, 10000] as const;

const QUOTER_ABI = [
  {
    type: 'function',
    name: 'quoteExactInputSingle',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'tokenIn', type: 'address' },
          { name: 'tokenOut', type: 'address' },
          { name: 'amountIn', type: 'uint256' },
          { name: 'fee', type: 'uint24' },
          { name: 'sqrtPriceLimitX96', type: 'uint160' },
        ],
      },
    ],
    outputs: [
      { name: 'amountOut', type: 'uint256' },
      { name: 'sqrtPriceX96After', type: 'uint160' },
      { name: 'initializedTicksCrossed', type: 'uint32' },
      { name: 'gasEstimate', type: 'uint256' },
    ],
  },
] as const;

const ROUTER_ABI = [
  {
    type: 'function',
    name: 'exactInputSingle',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'tokenIn', type: 'address' },
          { name: 'tokenOut', type: 'address' },
          { name: 'fee', type: 'uint24' },
          { name: 'recipient', type: 'address' },
          { name: 'amountIn', type: 'uint256' },
          { name: 'amountOutMinimum', type: 'uint256' },
          { name: 'sqrtPriceLimitX96', type: 'uint160' },
        ],
      },
    ],
    outputs: [{ name: 'amountOut', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'unwrapWETH9',
    stateMutability: 'payable',
    inputs: [
      { name: 'amountMinimum', type: 'uint256' },
      { name: 'recipient', type: 'address' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'multicall',
    stateMutability: 'payable',
    inputs: [{ name: 'data', type: 'bytes[]' }],
    outputs: [{ name: '', type: 'bytes[]' }],
  },
] as const;

const HEX40 = /^0x[a-fA-F0-9]{40}$/;

/** Best-quote across V3 fee tiers for tokenIn→tokenOut. Returns {amountOut, fee} or null. */
async function bestV3Quote(
  client: ReturnType<typeof createPublicClient>,
  tokenIn: `0x${string}`,
  tokenOut: `0x${string}`,
  amountIn: bigint,
): Promise<{ amountOut: bigint; fee: number } | null> {
  const results = await Promise.all(
    FEE_TIERS.map(async (fee): Promise<{ amountOut: bigint; fee: number } | null> => {
      try {
        const { result } = await client.simulateContract({
          address: QUOTER_V2,
          abi: QUOTER_ABI,
          functionName: 'quoteExactInputSingle',
          args: [{ tokenIn, tokenOut, amountIn, fee, sqrtPriceLimitX96: 0n }],
        });
        return { amountOut: result[0] as bigint, fee: fee as number };
      } catch {
        return null; // no pool at this tier
      }
    }),
  );
  const valid = results.filter((r): r is { amountOut: bigint; fee: number } => r != null && r.amountOut > 0n);
  if (!valid.length) return null;
  return valid.reduce((best, r) => (r.amountOut > best.amountOut ? r : best));
}

export async function buildRobinhoodSwapQuote(input: {
  side: 'buy' | 'sell';
  token: string;
  wallet: string;
  /** Buy: native wei to spend. Sell: token raw amount. */
  sellAmountRaw: string;
  slippageBps: number;
}): Promise<EvmSwapQuote> {
  const token = input.token.trim().toLowerCase();
  const wallet = input.wallet.trim();
  if (!HEX40.test(token)) throw new Error('invalid_token_address');
  if (!HEX40.test(wallet)) throw new Error('invalid_wallet_address');
  if (!/^\d+$/.test(input.sellAmountRaw) || input.sellAmountRaw === '0') throw new Error('invalid_sell_amount');

  const client = createPublicClient({ chain: robinhoodChain, transport: http(evmTradeRpcUrl('robinhood')) });
  const amountIn = BigInt(input.sellAmountRaw);

  const tokenIn = (input.side === 'buy' ? WETH : token) as `0x${string}`;
  const tokenOut = (input.side === 'buy' ? token : WETH) as `0x${string}`;

  const quote = await bestV3Quote(client, tokenIn, tokenOut, amountIn);
  if (!quote) throw new Error('no_uniswap_pool');
  const minOut = (quote.amountOut * BigInt(10_000 - input.slippageBps)) / 10_000n;

  let data: string;
  let value: string;
  let approvalAddress: string | null;

  if (input.side === 'buy') {
    // ETH → token: router wraps the sent ETH; token goes straight to the user.
    data = encodeFunctionData({
      abi: ROUTER_ABI,
      functionName: 'exactInputSingle',
      args: [
        {
          tokenIn: WETH,
          tokenOut: token as `0x${string}`,
          fee: quote.fee,
          recipient: wallet as `0x${string}`,
          amountIn,
          amountOutMinimum: minOut,
          sqrtPriceLimitX96: 0n,
        },
      ],
    });
    value = `0x${amountIn.toString(16)}`;
    approvalAddress = null; // spending native ETH — no ERC-20 approval
  } else {
    // token → ETH: swap to WETH held by the router, then unwrap to the user (multicall).
    const swapCall = encodeFunctionData({
      abi: ROUTER_ABI,
      functionName: 'exactInputSingle',
      args: [
        {
          tokenIn: token as `0x${string}`,
          tokenOut: WETH,
          fee: quote.fee,
          recipient: ADDRESS_THIS,
          amountIn,
          amountOutMinimum: minOut,
          sqrtPriceLimitX96: 0n,
        },
      ],
    });
    const unwrapCall = encodeFunctionData({
      abi: ROUTER_ABI,
      functionName: 'unwrapWETH9',
      args: [minOut, wallet as `0x${string}`],
    });
    data = encodeFunctionData({ abi: ROUTER_ABI, functionName: 'multicall', args: [[swapCall, unwrapCall]] });
    value = '0x0';
    approvalAddress = SWAP_ROUTER; // ERC-20 sell — approve the router
  }

  return {
    chainId: 4663,
    to: SWAP_ROUTER,
    data,
    value,
    approvalAddress,
    sellToken: input.side === 'buy' ? '0x0000000000000000000000000000000000000000' : token,
    buyToken: input.side === 'buy' ? token : '0x0000000000000000000000000000000000000000',
    sellAmountRaw: input.sellAmountRaw,
    buyAmountRaw: quote.amountOut.toString(),
    minBuyAmountRaw: minOut.toString(),
    tool: `uniswap-v3-${quote.fee}`,
  };
}
