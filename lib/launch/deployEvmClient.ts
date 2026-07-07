'use client';

import { createWalletClient, createPublicClient, http, custom } from 'viem';
import { mainnet, bsc, base } from 'viem/chains';
import type { ConnectedWallet } from '@privy-io/react-auth';
import type { LaunchPackageLaunchpad } from '@/lib/launch/types';
import {
  deployEvmPad,
  evmExplorerUrl,
  evmPadNeedsBase64Image,
  evmPadNeedsMetadataUri,
  type EvmPadChain,
} from '@/lib/launch/evmPads';

/**
 * Client-side EVM launch — deploys from the USER's own wallet (their "main wallet
 * is the deploy wallet"), no server burner key. Builds a viem walletClient from
 * the Privy EVM wallet's EIP-1193 provider and drives the shared pad registry
 * (clanker / zora-creator / flaunch — verified SDKs, never a hand-authored
 * contract). Pads that need pre-uploaded metadata (zora JSON URI, flaunch base64
 * image) get it from /api/launch/evm-meta first (server-side, dodges CORS).
 *
 * Real-money path — test small before relying on it.
 */

export type EvmClientChain = EvmPadChain;

const VIEM_CHAIN = { eth: mainnet, bnb: bsc, base: base } as const;
const CHAIN_ID = { eth: 1, bnb: 56, base: 8453 } as const;

export type DeployEvmClientInput = {
  name: string;
  symbol: string;
  description?: string;
  imageUrl?: string | null;
  twitter?: string | null;
  website?: string | null;
  launchpad: LaunchPackageLaunchpad;
  /** Pre-fetched server metadata (zora URI / flaunch base64 image), if needed. */
  metadataUri?: string | null;
  base64Image?: string | null;
};

export async function deployEvmClient(
  wallet: ConnectedWallet,
  chain: EvmClientChain,
  input: DeployEvmClientInput,
): Promise<{ tokenAddress: string; txHash: string; explorerUrl: string }> {
  const chainId = CHAIN_ID[chain];
  // Make sure the Privy wallet is on the target chain before we build the client.
  await wallet.switchChain(chainId);
  const provider = await wallet.getEthereumProvider();
  const account = wallet.address as `0x${string}`;
  const walletClient = createWalletClient({ account, chain: VIEM_CHAIN[chain], transport: custom(provider) });
  const publicClient = createPublicClient({ chain: VIEM_CHAIN[chain], transport: http() });

  const { tokenAddress, txHash } = await deployEvmPad({
    launchpad: input.launchpad,
    chain,
    walletClient,
    publicClient,
    account,
    name: input.name,
    symbol: input.symbol,
    description: input.description,
    imageUrl: input.imageUrl ?? null,
    twitter: input.twitter ?? null,
    metadataUri: input.metadataUri ?? null,
    base64Image: input.base64Image ?? null,
  });

  return { tokenAddress, txHash, explorerUrl: evmExplorerUrl(chain, tokenAddress, txHash) };
}

/** Whether a pad needs the server metadata step before the client can deploy it. */
export function evmClientNeedsMeta(launchpad: LaunchPackageLaunchpad): boolean {
  return evmPadNeedsMetadataUri(launchpad) || evmPadNeedsBase64Image(launchpad);
}
