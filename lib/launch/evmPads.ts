import type { LaunchPackageLaunchpad } from '@/lib/launch/types';

/**
 * EVM launchpad registry — one dispatch used by BOTH the client path
 * (deployEvmClient, user's Privy wallet) and the server path (deployEvmToken,
 * auto-launch burner). Given a viem walletClient + publicClient (either origin),
 * it deploys through the selected pad's verified SDK. Heavy SDKs are dynamically
 * imported so they never weigh down the main bundle.
 *
 * Wired pads (verified, maintained SDKs):
 *  - clanker      → ETH (1) / Base (8453) / BSC (56)   clanker-sdk v4
 *  - zora-creator → Base (8453)                        @zoralabs/coins-sdk
 *  - flaunch      → Base (8453)                         @flaunch/sdk
 *
 * Everything else throws an honest "not wired" — we never guess a contract.
 * Real-money path: test each pad with a tiny launch before relying on it.
 */

export type EvmPadChain = 'eth' | 'bnb' | 'base';

/** clanker/zora/flaunch chain ids (literals to satisfy each SDK's union). */
const CHAIN_ID = { eth: 1, bnb: 56, base: 8453 } as const;

/** Whether a pad has a wired factory on a given chain. */
export function evmPadWired(chain: EvmPadChain, pad: LaunchPackageLaunchpad): boolean {
  if (pad === 'clanker') return true; // eth / base / bnb
  if (pad === 'zora-creator') return chain === 'base';
  if (pad === 'flaunch') return chain === 'base';
  return false;
}

/** Pads that need a pre-uploaded JSON metadata URI (built server-side). */
export function evmPadNeedsMetadataUri(pad: LaunchPackageLaunchpad): boolean {
  return pad === 'zora-creator';
}
/** Pads that need a base64 image (built server-side). */
export function evmPadNeedsBase64Image(pad: LaunchPackageLaunchpad): boolean {
  return pad === 'flaunch';
}

export type EvmPadParams = {
  launchpad: LaunchPackageLaunchpad;
  chain: EvmPadChain;
  /** viem WalletClient — cast per SDK across the bundled-viem version boundary. */
  walletClient: unknown;
  publicClient: unknown;
  account: `0x${string}`;
  name: string;
  symbol: string;
  description?: string;
  imageUrl?: string | null;
  twitter?: string | null;
  /** Pre-uploaded JSON metadata URI (zora-creator). */
  metadataUri?: string | null;
  /** data: base64 image (flaunch). */
  base64Image?: string | null;
};

export type EvmPadResult = { tokenAddress: string; txHash: string };

export function evmExplorerUrl(chain: EvmPadChain, tokenAddress: string, txHash: string): string {
  const base = { eth: 'https://etherscan.io', bnb: 'https://bscscan.com', base: 'https://basescan.org' }[chain];
  return tokenAddress ? `${base}/token/${tokenAddress}` : `${base}/tx/${txHash}`;
}

export async function deployEvmPad(p: EvmPadParams): Promise<EvmPadResult> {
  if (!evmPadWired(p.chain, p.launchpad)) {
    const extra = p.chain === 'base' ? ', zora-creator or flaunch' : '';
    throw new Error(`${p.launchpad} isn’t wired on ${p.chain.toUpperCase()} yet — pick clanker${extra}.`);
  }
  const chainId = CHAIN_ID[p.chain];

  if (p.launchpad === 'clanker') {
    const { Clanker } = await import('clanker-sdk/v4');
    const clanker = new Clanker({ wallet: p.walletClient, publicClient: p.publicClient } as unknown as ConstructorParameters<typeof Clanker>[0]);
    const socialMediaUrls = p.twitter ? [{ platform: 'x', url: p.twitter }] : [];
    const res = await clanker.deploy({
      name: p.name,
      symbol: p.symbol,
      image: p.imageUrl ?? '',
      chainId,
      tokenAdmin: p.account,
      metadata: { description: p.description ?? '', socialMediaUrls, auditUrls: [] },
    });
    if (res.error) throw new Error(res.error.message || 'clanker_deploy_failed');
    const waited = await res.waitForTransaction();
    if (waited.error) throw new Error(waited.error.message || 'clanker_confirm_failed');
    return { tokenAddress: waited.address, txHash: res.txHash };
  }

  if (p.launchpad === 'zora-creator') {
    if (!p.metadataUri) throw new Error('zora_metadata_missing');
    const { createCoin } = await import('@zoralabs/coins-sdk');
    const { hash, address } = await createCoin({
      call: {
        creator: p.account,
        name: p.name,
        symbol: p.symbol,
        metadata: { type: 'RAW_URI', uri: p.metadataUri },
        currency: 'ETH',
        chainId,
        startingMarketCap: 'LOW',
        skipMetadataValidation: true,
      },
      walletClient: p.walletClient as never,
      publicClient: p.publicClient as never,
    });
    return { tokenAddress: address ?? '', txHash: hash };
  }

  if (p.launchpad === 'flaunch') {
    if (!p.base64Image) throw new Error('flaunch_image_missing');
    const { createFlaunch } = await import('@flaunch/sdk');
    const sdk = createFlaunch({ publicClient: p.publicClient as never, walletClient: p.walletClient as never });
    // flaunchIPFS uploads metadata + flaunches, returning the tx hash. The token
    // address is derivable from the receipt on-chain; the explorer link uses the tx.
    const txHash = await sdk.flaunchIPFS({
      name: p.name,
      symbol: p.symbol,
      creator: p.account,
      creatorFeeAllocationPercent: 80,
      fairLaunchPercent: 60,
      fairLaunchDuration: 1800, // 30 min fair launch (seconds)
      initialMarketCapUSD: 1000,
      metadata: { base64Image: p.base64Image, description: p.description ?? '' },
    });
    return { tokenAddress: '', txHash };
  }

  throw new Error(`evm_launchpad_not_wired:${p.launchpad}`);
}
