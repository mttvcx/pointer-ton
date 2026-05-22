import type { ProtocolBrandId } from '@/lib/tokens/protocolBrand';

/** Solana launchpads the AI may recommend (subset of ProtocolBrandId). */
export const LAUNCH_PACKAGE_LAUNCHPADS = [
  'pump.fun',
  'bonk',
  'moonshot',
  'bags',
  'bonkers',
  'heaven',
] as const satisfies readonly ProtocolBrandId[];

export type LaunchPackageLaunchpad = (typeof LAUNCH_PACKAGE_LAUNCHPADS)[number];

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
