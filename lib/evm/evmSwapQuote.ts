import 'server-only';

import { fetchLifiQuote } from '@/lib/bridge/lifi';
import {
  EVM_NATIVE_SENTINEL,
  EVM_NUMERIC_CHAIN_ID,
  isNativeEvmToken,
  type EvmTradeChain,
} from '@/lib/evm/evmTradeChains';

/**
 * Normalized EVM swap quote returned to the client. The client validates
 * `chainId` and the calldata `to`/`value` before signing, then LiFi's own
 * `minToAmount` (baked into the calldata) enforces slippage on-chain.
 */
export type EvmSwapQuote = {
  chainId: number;
  /** Router/diamond to send the swap tx to. */
  to: string;
  /** Swap calldata. */
  data: string;
  /** Native value to send (wei, 0 for ERC-20 -> X). */
  value: string;
  /** ERC-20 spender to approve when sellToken is not native (null for native sells). */
  approvalAddress: string | null;
  sellToken: string;
  buyToken: string;
  sellAmountRaw: string;
  /** Expected out (raw) and the slippage-protected minimum (raw). */
  buyAmountRaw: string;
  minBuyAmountRaw: string;
  tool: string;
};

export type BuildEvmSwapInput = {
  chain: EvmTradeChain;
  side: 'buy' | 'sell';
  /** The traded token (ERC-20 `0x…`). */
  token: string;
  /** User's EVM wallet address (from + to of the swap). */
  wallet: string;
  /**
   * Raw sell amount. For a buy: native wei to spend. For a sell: token raw amount.
   * Must be a positive integer string.
   */
  sellAmountRaw: string;
  slippageBps: number;
};

const HEX40 = /^0x[a-fA-F0-9]{40}$/;

export async function buildEvmSwapQuote(input: BuildEvmSwapInput): Promise<EvmSwapQuote> {
  const chainId = EVM_NUMERIC_CHAIN_ID[input.chain];
  const token = input.token.trim();
  const wallet = input.wallet.trim();
  if (!HEX40.test(token)) throw new Error('invalid_token_address');
  if (!HEX40.test(wallet)) throw new Error('invalid_wallet_address');
  if (!/^\d+$/.test(input.sellAmountRaw) || input.sellAmountRaw === '0') {
    throw new Error('invalid_sell_amount');
  }

  // Buy = spend native gas token for the token; Sell = token for native.
  const fromToken = input.side === 'buy' ? EVM_NATIVE_SENTINEL : token;
  const toToken = input.side === 'buy' ? token : EVM_NATIVE_SENTINEL;

  const lifi = await fetchLifiQuote({
    fromChain: String(chainId),
    toChain: String(chainId), // same-chain swap
    fromToken,
    toToken,
    fromAmount: input.sellAmountRaw,
    fromAddress: wallet,
    toAddress: wallet,
    slippage: input.slippageBps / 10_000,
  });

  const tx = lifi.transactionRequest;
  if (!tx?.to || !tx?.data) throw new Error('lifi_no_transaction');
  if (!HEX40.test(tx.to)) throw new Error('lifi_bad_to');
  // Same-chain safety: the calldata target chain must match what we quoted.
  if (tx.chainId != null && tx.chainId !== chainId) throw new Error('lifi_chain_mismatch');

  const sellNative = isNativeEvmToken(fromToken);

  return {
    chainId,
    to: tx.to,
    data: tx.data,
    value: sellNative ? (tx.value ?? '0x0') : '0x0',
    approvalAddress: sellNative ? null : (lifi.estimate.approvalAddress ?? tx.to),
    sellToken: fromToken,
    buyToken: toToken,
    sellAmountRaw: lifi.estimate.fromAmount || input.sellAmountRaw,
    buyAmountRaw: lifi.estimate.toAmount,
    minBuyAmountRaw: lifi.estimate.toAmountMin,
    tool: lifi.tool ?? 'lifi',
  };
}
