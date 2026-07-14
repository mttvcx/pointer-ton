import 'server-only';

import { fetchLifiQuote, type LifiFeeCost } from '@/lib/bridge/lifi';
import {
  EVM_NATIVE_SENTINEL,
  EVM_NUMERIC_CHAIN_ID,
  isNativeEvmToken,
  type EvmTradeChain,
} from '@/lib/evm/evmTradeChains';
import { EVM_FEE_BPS, evmFeeFractionForChain } from '@/lib/evm/evmFee';

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
  /** Pointer fee charged on this swap (bps). 0 when the EVM fee is off / not applied. */
  pointerFeeBps: number;
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

/**
 * Did LiFi actually apply our integrator fee? We match on the fee percentage
 * (LiFi echoes it back as `percentage`) with a tolerance, or an integrator-named
 * fee line. Used to guarantee: when fees are ON, a *successful* quote always
 * carries the fee — so the execute route can safely rebate cashback.
 */
function lifiIntegratorFeeApplied(feeCosts: LifiFeeCost[] | undefined, expectedFraction: number): boolean {
  if (!feeCosts?.length) return false;
  return feeCosts.some((fc) => {
    const amt = Number(fc.amount ?? '0');
    if (!(amt > 0)) return false;
    const pct = Number(fc.percentage);
    if (Number.isFinite(pct)) {
      // LiFi may echo the fee as a fraction (0.015) OR a percent (1.5) — accept both.
      if (Math.abs(pct - expectedFraction) <= 0.0005) return true;
      if (Math.abs(pct - expectedFraction * 100) <= 0.05) return true;
    }
    const label = `${fc.name ?? ''} ${fc.description ?? ''}`.toLowerCase();
    return /lifi|integrator|pointer/.test(label);
  });
}

export async function buildEvmSwapQuote(input: BuildEvmSwapInput): Promise<EvmSwapQuote> {
  // Robinhood routes through direct Uniswap (buildRobinhoodSwapQuote), never LiFi.
  if (input.chain === 'robinhood') throw new Error('robinhood_uses_uniswap');
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

  // Pointer's 1.5% fee (only when enabled + this is a LiFi chain). 0 = no fee sent.
  const feeFraction = evmFeeFractionForChain(input.chain);

  const baseParams = {
    fromChain: String(chainId),
    toChain: String(chainId), // same-chain swap
    fromToken,
    toToken,
    fromAmount: input.sellAmountRaw,
    fromAddress: wallet,
    toAddress: wallet,
    slippage: input.slippageBps / 10_000,
  } as const;

  // GRACEFUL FALLBACK — the trade must never break because of fee config.
  // Try WITH the fee; if LiFi rejects it (integrator not fee-authorized yet) or
  // silently ignores it (fee not present in feeCosts), fall back to a plain no-fee
  // swap so the swap still executes. `feeApplied` then tells the execute route
  // whether cashback may accrue — we NEVER rebate a fee that wasn't collected.
  let lifi;
  let feeApplied = false;
  if (feeFraction > 0) {
    try {
      const withFee = await fetchLifiQuote({ ...baseParams, fee: feeFraction });
      if (lifiIntegratorFeeApplied(withFee.estimate.feeCosts, feeFraction)) {
        lifi = withFee;
        feeApplied = true;
      } else {
        lifi = await fetchLifiQuote(baseParams); // silent-ignore → explicit no-fee
      }
    } catch {
      lifi = await fetchLifiQuote(baseParams); // fee rejected → no-fee swap still works
    }
  } else {
    lifi = await fetchLifiQuote(baseParams);
  }

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
    // Only claims a fee when LiFi actually applied it → cashback stays honest.
    pointerFeeBps: feeApplied ? EVM_FEE_BPS : 0,
  };
}
