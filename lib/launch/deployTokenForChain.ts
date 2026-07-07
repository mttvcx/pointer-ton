import 'server-only';

import type { AppChainId } from '@/lib/chains/appChain';
import { deployPumpToken } from '@/lib/launch/deployPumpToken';
import { deployEvmToken } from '@/lib/launch/deployEvmToken';
import type { LaunchPackageLaunchpad } from '@/lib/launch/types';

/**
 * Unified manual-launch dispatcher — the one entry the deploy API calls. Routes
 * by chain to the chain-specific deployer (SOL pump.fun, EVM viem, TON later)
 * and normalizes the result so the UI is chain-agnostic.
 */

export type DeployTokenInput = {
  name: string;
  symbol: string;
  description?: string;
  imageUrl?: string | null;
  twitter?: string | null;
  website?: string | null;
  launchpad: LaunchPackageLaunchpad;
  /** Dev buy in the chain's native unit (SOL / ETH / BNB). Clamped downstream. */
  devBuyNative?: number;
};

export type DeployTokenResult = {
  chain: AppChainId;
  tokenAddress: string;
  txHash: string;
  explorerUrl: string;
};

function explorerUrl(chain: AppChainId, address: string): string {
  switch (chain) {
    case 'sol':
      return `https://solscan.io/token/${address}`;
    case 'eth':
      return `https://etherscan.io/token/${address}`;
    case 'bnb':
      return `https://bscscan.com/token/${address}`;
    case 'base':
      return `https://basescan.org/token/${address}`;
    default:
      return address;
  }
}

export async function deployTokenForChain(
  chain: AppChainId,
  input: DeployTokenInput,
): Promise<DeployTokenResult> {
  if (chain === 'eth' || chain === 'bnb' || chain === 'base') {
    const r = await deployEvmToken(chain, {
      name: input.name,
      symbol: input.symbol,
      description: input.description,
      imageUrl: input.imageUrl,
      twitter: input.twitter,
      website: input.website,
      launchpad: input.launchpad,
      devBuyNative: input.devBuyNative,
    });
    return { chain, tokenAddress: r.contractAddress, txHash: r.txHash, explorerUrl: explorerUrl(chain, r.contractAddress) };
  }

  if (chain === 'ton') {
    // TON Jetton deploy — wired next (needs a TON deploy wallet + launchpad).
    throw new Error('ton_launch_not_wired');
  }

  // Solana — real pump.fun deploy.
  const r = await deployPumpToken({
    name: input.name,
    symbol: input.symbol,
    description: input.description,
    imageUrl: input.imageUrl,
    twitter: input.twitter,
    website: input.website,
    devBuySol: input.devBuyNative,
  });
  return { chain: 'sol', tokenAddress: r.mint, txHash: r.signature, explorerUrl: explorerUrl('sol', r.mint) };
}
