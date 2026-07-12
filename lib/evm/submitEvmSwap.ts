'use client';

import { createWalletClient, createPublicClient, custom, http } from 'viem';
import type { ConnectedWallet } from '@privy-io/react-auth';
import {
  ERC20_ABI,
  EVM_VIEM_CHAIN,
  EVM_NUMERIC_CHAIN_ID,
  type EvmTradeChain,
} from '@/lib/evm/evmTradeChains';
import type { EvmSwapQuote } from '@/lib/evm/evmSwapQuote';

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
  await wallet.switchChain(chainId);
  const provider = await wallet.getEthereumProvider();
  const account = wallet.address as `0x${string}`;
  const viemChain = EVM_VIEM_CHAIN[chain];
  const walletClient = createWalletClient({ account, chain: viemChain, transport: custom(provider) });
  const publicClient = createPublicClient({ chain: viemChain, transport: http() });

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
      const approveRcpt = await publicClient.waitForTransactionReceipt({ hash: approveHash });
      if (approveRcpt.status !== 'success') throw new Error('approve_failed');
    }
  }

  onStage?.('swapping');
  const txHash = await walletClient.sendTransaction({
    account,
    chain: viemChain,
    to: quote.to as `0x${string}`,
    data: quote.data as `0x${string}`,
    value,
  });

  onStage?.('confirming');
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status !== 'success') throw new Error('swap_reverted');

  return { txHash };
}
