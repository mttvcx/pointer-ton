'use client';

import { createWalletClient, createPublicClient, http, custom } from 'viem';
import { mainnet, bsc, base } from 'viem/chains';
import type { ConnectedWallet } from '@privy-io/react-auth';
import type { LaunchPackageLaunchpad } from '@/lib/launch/types';

/**
 * Client-side EVM launch — deploys from the USER's own wallet (their "main wallet
 * is the deploy wallet"), no server burner key. Builds a viem walletClient from
 * the Privy EVM wallet's EIP-1193 provider and drives the maintained clanker-sdk
 * (verified factory on-chain — we never hand-author a contract address). The
 * clanker v4 factory supports Ethereum (1), Base (8453) and BSC (56).
 *
 * Only the `clanker` pad is wired so far; other pads throw an honest "not wired"
 * so nothing silently misfires. Real-money path — test small before relying on it.
 */

export type EvmClientChain = 'eth' | 'bnb' | 'base';

const VIEM_CHAIN = { eth: mainnet, bnb: bsc, base: base } as const;
/** clanker-supported chain ids (literals so they satisfy the SDK's chainId union). */
const CHAIN_ID = { eth: 1, bnb: 56, base: 8453 } as const;
const EXPLORER: Record<EvmClientChain, (a: string) => string> = {
  eth: (a) => `https://etherscan.io/token/${a}`,
  bnb: (a) => `https://bscscan.com/token/${a}`,
  base: (a) => `https://basescan.org/token/${a}`,
};

export type DeployEvmClientInput = {
  name: string;
  symbol: string;
  description?: string;
  imageUrl?: string | null;
  twitter?: string | null;
  website?: string | null;
  launchpad: LaunchPackageLaunchpad;
};

export async function deployEvmClient(
  wallet: ConnectedWallet,
  chain: EvmClientChain,
  input: DeployEvmClientInput,
): Promise<{ tokenAddress: string; txHash: string; explorerUrl: string }> {
  // Only clanker is wired to a real factory so far — keep the rest honest.
  if (input.launchpad !== 'clanker') {
    throw new Error(`${input.launchpad} isn’t wired for launch yet — pick clanker.`);
  }

  const chainId = CHAIN_ID[chain];
  // Make sure the Privy wallet is on the target chain before we build the client.
  await wallet.switchChain(chainId);
  const provider = await wallet.getEthereumProvider();
  const account = wallet.address as `0x${string}`;
  const walletClient = createWalletClient({ account, chain: VIEM_CHAIN[chain], transport: custom(provider) });
  const publicClient = createPublicClient({ chain: VIEM_CHAIN[chain], transport: http() });

  // Heavy SDK stays out of the main bundle. clanker-sdk bundles its own copy of
  // viem, so its client types are structurally unrelated to the app's viem — cast
  // across that version boundary (runtime shape is identical).
  const { Clanker } = await import('clanker-sdk/v4');
  const clanker = new Clanker({ wallet: walletClient, publicClient } as unknown as ConstructorParameters<typeof Clanker>[0]);

  const socialMediaUrls = input.twitter ? [{ platform: 'x', url: input.twitter }] : [];
  const res = await clanker.deploy({
    name: input.name,
    symbol: input.symbol,
    image: input.imageUrl ?? '',
    chainId,
    tokenAdmin: account,
    metadata: { description: input.description ?? '', socialMediaUrls, auditUrls: [] },
  });
  if (res.error) throw new Error(res.error.message || 'clanker_deploy_failed');

  const waited = await res.waitForTransaction();
  if (waited.error) throw new Error(waited.error.message || 'clanker_confirm_failed');

  return { tokenAddress: waited.address, txHash: res.txHash, explorerUrl: EXPLORER[chain](waited.address) };
}
