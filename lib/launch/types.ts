import type { ProtocolBrandId } from '@/lib/tokens/protocolBrand';
import type { AppChainId } from '@/lib/chains/appChain';

/** Solana launchpads the AI may recommend (subset of ProtocolBrandId). */
export const SOL_LAUNCHPADS = [
  'pump.fun',
  'bonk',
  'moonshot',
  'bags',
  'bonkers',
  'heaven',
] as const satisfies readonly ProtocolBrandId[];

/** EVM launchpads the AI may recommend, per chain (first = default). */
export const EVM_LAUNCHPADS: Record<'eth' | 'bnb' | 'base', readonly ProtocolBrandId[]> = {
  eth: ['clanker', 'uniswap', 'virtuals'],
  bnb: ['four.meme', 'pancakeswap', 'flap'],
  base: ['clanker', 'flaunch', 'zora-creator', 'bankr', 'virtuals'],
};

/** Every launchpad the AI may pick across all chains (deduped union). */
export const LAUNCH_PACKAGE_LAUNCHPADS = [
  ...SOL_LAUNCHPADS,
  'clanker',
  'uniswap',
  'virtuals',
  'four.meme',
  'pancakeswap',
  'flap',
  'flaunch',
  'zora-creator',
  'bankr',
] as const satisfies readonly ProtocolBrandId[];

export type LaunchPackageLaunchpad = (typeof LAUNCH_PACKAGE_LAUNCHPADS)[number];

/** Launchpads valid for a chain (Solana set, or the EVM set for that chain). */
export function launchpadsForChain(chain: AppChainId): readonly LaunchPackageLaunchpad[] {
  if (chain === 'eth') return EVM_LAUNCHPADS.eth as readonly LaunchPackageLaunchpad[];
  if (chain === 'bnb') return EVM_LAUNCHPADS.bnb as readonly LaunchPackageLaunchpad[];
  if (chain === 'base') return EVM_LAUNCHPADS.base as readonly LaunchPackageLaunchpad[];
  return SOL_LAUNCHPADS as readonly LaunchPackageLaunchpad[];
}

/** The default launchpad for a chain (first in its list). */
export function defaultLaunchpadForChain(chain: AppChainId): LaunchPackageLaunchpad {
  return launchpadsForChain(chain)[0]!;
}

export type LaunchImageStrategy = 'use_tweet_image' | 'generate' | 'no_image';

export type TweetLaunchInput = {
  /** Stable tweet id from ingest (preferred cache key). */
  id?: string;
  text: string;
  authorHandle: string;
  imageUrls?: string[];
  tweetUrl?: string | null;
};

export type LaunchPackageVariant = {
  suggestedName: string;
  suggestedTicker: string;
  narrative: string;
  suggestedLaunchpad: LaunchPackageLaunchpad;
  imageStrategy: LaunchImageStrategy;
  reasoning: string;
};

/** Primary fields mirror `variants[0]` when `shouldLaunch` is true. */
export type LaunchPackage = {
  shouldLaunch: boolean;
  confidence: number;
  suggestedName: string;
  suggestedTicker: string;
  narrative: string;
  suggestedLaunchpad: LaunchPackageLaunchpad;
  imageStrategy: LaunchImageStrategy;
  reasoning: string;
  /** Three ranked deploy ideas for the tweet (UI rail). Present when `shouldLaunch`. */
  variants?: [LaunchPackageVariant, LaunchPackageVariant, LaunchPackageVariant];
};

export type LaunchPackageChip = {
  label: string;
  value: string;
};

/** Three inline “suggestions” per launch-worthy tweet (name · ticker · pad). */
export function launchPackageChips(pkg: LaunchPackage): LaunchPackageChip[] {
  return [
    { label: 'Name', value: pkg.suggestedName },
    { label: 'Ticker', value: `$${pkg.suggestedTicker.replace(/^\$/, '')}` },
    { label: 'Pad', value: pkg.suggestedLaunchpad },
  ];
}
