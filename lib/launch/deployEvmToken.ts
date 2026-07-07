import 'server-only';

import { createWalletClient, createPublicClient, http, type Chain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet, bsc, base } from 'viem/chains';
import type { LaunchPackageLaunchpad } from '@/lib/launch/types';
import { deployEvmPad, evmPadNeedsBase64Image, evmPadNeedsMetadataUri } from '@/lib/launch/evmPads';
import { buildEvmLaunchMeta } from '@/lib/launch/evmLaunchMeta';

/**
 * EVM token deploy (ETH / BNB / Base) — the server (auto-launch) counterpart to
 * deployPumpToken. Signs with the server EVM burner (EVM_DEPLOY_WALLET_KEY) via
 * viem, then dispatches through the shared pad registry (deployEvmPad) — the same
 * clanker / zora / flaunch integrations the client path uses. Pads that need
 * pre-uploaded metadata get it server-side here; unwired pads throw honestly.
 */

export type EvmDeployChain = 'eth' | 'bnb' | 'base';

const VIEM_CHAIN: Record<EvmDeployChain, Chain> = { eth: mainnet, bnb: bsc, base: base };

/** RPC URL per chain — env override, else the chain's public default. */
function rpcUrl(chain: EvmDeployChain): string {
  const env = {
    eth: process.env.ETH_RPC_URL,
    bnb: process.env.BSC_RPC_URL,
    base: process.env.BASE_RPC_URL,
  }[chain]?.trim();
  return env || VIEM_CHAIN[chain].rpcUrls.default.http[0]!;
}

/** A `0x`-prefixed EVM private key for the deploy burner. */
function deployPrivateKey(): `0x${string}` {
  const raw = process.env.EVM_DEPLOY_WALLET_KEY?.trim();
  if (!raw) throw new Error('evm_deploy_wallet_not_configured');
  const key = raw.startsWith('0x') ? raw : `0x${raw}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) throw new Error('evm_deploy_wallet_invalid');
  return key as `0x${string}`;
}

export function evmDeployWalletConfigured(): boolean {
  return Boolean(process.env.EVM_DEPLOY_WALLET_KEY?.trim());
}

/** EVM auto-launch enabled (same two-seatbelt model as Solana). */
export function evmAutoLaunchEnabled(): boolean {
  return evmDeployWalletConfigured() && process.env.POINTER_EVM_LAUNCH_ENABLED?.trim() === '1';
}

export type DeployEvmTokenInput = {
  name: string;
  symbol: string;
  description?: string;
  imageUrl?: string | null;
  twitter?: string | null;
  website?: string | null;
  launchpad: LaunchPackageLaunchpad;
  /** Dev buy in native units (ETH/BNB) — clamped by the caller. 0 = create only. */
  devBuyNative?: number;
};

export type DeployEvmTokenResult = { contractAddress: string; txHash: string; chain: EvmDeployChain };

function clients(chain: EvmDeployChain) {
  const account = privateKeyToAccount(deployPrivateKey());
  const transport = http(rpcUrl(chain));
  const wallet = createWalletClient({ account, chain: VIEM_CHAIN[chain], transport });
  const publicClient = createPublicClient({ chain: VIEM_CHAIN[chain], transport });
  return { account, wallet, publicClient };
}

/**
 * The launchpad-specific factory call. Wire each supported launchpad's verified
 * contract (address + ABI) here — e.g. four.meme's token manager (BNB), clanker's
 * factory (Base), flaunch (Base). Given `clients()` (a funded viem wallet), submit
 * the create tx and return the token address + tx hash.
 */
export async function deployEvmToken(
  chain: EvmDeployChain,
  input: DeployEvmTokenInput,
): Promise<DeployEvmTokenResult> {
  const c = clients(chain); // throws if the burner key is missing/invalid

  // Pads that need pre-uploaded metadata (zora JSON URI / flaunch base64 image)
  // get it server-side here; clanker takes the image URL directly.
  let metadataUri: string | null = null;
  let base64Image: string | null = null;
  if (evmPadNeedsMetadataUri(input.launchpad) || evmPadNeedsBase64Image(input.launchpad)) {
    const meta = await buildEvmLaunchMeta({
      name: input.name,
      symbol: input.symbol,
      description: input.description ?? null,
      imageUrl: input.imageUrl ?? null,
      twitter: input.twitter ?? null,
      website: input.website ?? null,
    });
    metadataUri = meta.metadataUri;
    base64Image = meta.base64Image;
  }

  const { tokenAddress, txHash } = await deployEvmPad({
    launchpad: input.launchpad,
    chain,
    walletClient: c.wallet,
    publicClient: c.publicClient,
    account: c.account.address,
    name: input.name,
    symbol: input.symbol,
    description: input.description,
    imageUrl: input.imageUrl ?? null,
    twitter: input.twitter ?? null,
    metadataUri,
    base64Image,
  });

  // Shape-compat: contractAddress is empty for pads that only return a tx (flaunch);
  // callers fall back to the tx hash for the explorer link.
  return { contractAddress: tokenAddress || txHash, txHash, chain };
}
