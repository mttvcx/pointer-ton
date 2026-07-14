'use client';

import { createWalletClient, custom } from 'viem';
import type { ConnectedWallet } from '@privy-io/react-auth';
import {
  ERC20_ABI,
  EVM_VIEM_CHAIN,
  EVM_NUMERIC_CHAIN_ID,
  type EvmTradeChain,
} from '@/lib/evm/evmTradeChains';
import { evmPublicClient } from '@/lib/evm/evmRpc';
import type { EvmSwapQuote } from '@/lib/evm/evmSwapQuote';

/** How long to wait for a swap receipt before returning optimistically (server verifies). */
const RECEIPT_TIMEOUT_MS = 60_000;
const APPROVE_TIMEOUT_MS = 90_000;

const HEX40 = /^0x[a-fA-F0-9]{40}$/;

/**
 * Execute an EVM swap from the user's Privy wallet: (optionally) approve the
 * sell token for the router, then send the swap calldata and wait for it to
 * confirm. Reuses the proven launch-path wallet-client construction.
 *
 * Real-money path. Approvals are for the EXACT sell amount (never unbounded), the
 * target chain is re-asserted client-side, and the router `to` must match the
 * server quote. Slippage is enforced by LiFi's min-out baked into the calldata.
 */
export async function submitEvmSwap(
  wallet: ConnectedWallet,
  chain: EvmTradeChain,
  quote: EvmSwapQuote,
  onStage?: (s: 'approving' | 'swapping' | 'confirming') => void,
): Promise<{ txHash: string }> {
  const chainId = EVM_NUMERIC_CHAIN_ID[chain];
  if (quote.chainId !== chainId) throw new Error('quote_chain_mismatch');
  if (!HEX40.test(quote.to)) throw new Error('bad_router_address');
  if (typeof quote.data !== 'string' || !quote.data.startsWith('0x')) throw new Error('bad_calldata');

  // Make sure the Privy wallet is on the target chain before building the client.
  // Time-boxed — a hung switchChain/provider must surface an error, never freeze.
  const withTimeout = <T>(p: Promise<T>, ms: number, label: string): Promise<T> =>
    Promise.race([
      p,
      new Promise<T>((_, rej) => setTimeout(() => rej(new Error(label)), ms)),
    ]);
  await withTimeout(wallet.switchChain(chainId), 20_000, 'wallet_switch_chain_timeout');
  const provider = await withTimeout(wallet.getEthereumProvider(), 15_000, 'wallet_provider_timeout');
  const account = wallet.address as `0x${string}`;
  const viemChain = EVM_VIEM_CHAIN[chain];
  const walletClient = createWalletClient({ account, chain: viemChain, transport: custom(provider) });
  // Reliable RPCs (never viem's flaky default) so receipt-waiting can't hang for minutes.
  const publicClient = evmPublicClient(chain);

  const value = BigInt(quote.value || '0x0');
  const sellAmount = BigInt(quote.sellAmountRaw);

  // ERC-20 sell → ensure the router has an allowance for the EXACT sell amount.
  if (quote.approvalAddress && HEX40.test(quote.approvalAddress) && HEX40.test(quote.sellToken)) {
    const spender = quote.approvalAddress as `0x${string}`;
    const sellToken = quote.sellToken as `0x${string}`;
    const current = (await publicClient.readContract({
      address: sellToken,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [account, spender],
    })) as bigint;
    if (current < sellAmount) {
      onStage?.('approving');
      const approveHash = await walletClient.writeContract({
        address: sellToken,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [spender, sellAmount],
        chain: viemChain,
        account,
      });
      const approveRcpt = await publicClient.waitForTransactionReceipt({
        hash: approveHash,
        timeout: APPROVE_TIMEOUT_MS,
      });
      if (approveRcpt.status !== 'success') throw new Error('approve_failed');
    }
  }

  onStage?.('swapping');
  // Pre-compute nonce + gas on reliable RPCs so viem doesn't run the (slow)
  // estimation through the wallet provider — that estimation is what hung for
  // minutes. Fees are left to the wallet (Privy now uses fast RPCs via override).
  const to = quote.to as `0x${string}`;
  const data = quote.data as `0x${string}`;
  const [nonce, gas] = await Promise.all([
    publicClient.getTransactionCount({ address: account }).catch(() => undefined),
    publicClient
      .estimateGas({ account, to, data, value })
      .then((g) => (g * 12n) / 10n) // +20% headroom
      .catch(() => undefined), // simulation failed → let the wallet estimate
  ]);
  const txHash = await walletClient.sendTransaction({
    account,
    chain: viemChain,
    to,
    data,
    value,
    ...(nonce != null ? { nonce } : {}),
    ...(gas != null ? { gas } : {}),
  });

  onStage?.('confirming');
  try {
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
      timeout: RECEIPT_TIMEOUT_MS,
    });
    if (receipt.status !== 'success') throw new Error('swap_reverted');
  } catch (err) {
    // A genuine on-chain revert propagates. Anything else (slow RPC, receipt
    // timeout) — the tx is already broadcast, so stop blocking the UI and return
    // the hash; /api/trade/execute confirms real success via verifyEvmSwapTx
    // before crediting points/cashback.
    if (err instanceof Error && err.message === 'swap_reverted') throw err;
  }

  return { txHash };
}
