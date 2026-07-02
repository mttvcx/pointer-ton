'use client';

import type { LaunchPackage, LaunchPackageVariant, TweetLaunchInput } from '@/lib/launch/types';
import type { LaunchModalDraft } from '@/store/launchModal';
import { useLaunchModalStore } from '@/store/launchModal';
import { useAutoLaunchStore } from '@/store/autoLaunch';

export function variantToDraft(
  tweetSubject: string,
  tweet: TweetLaunchInput,
  variant: LaunchPackageVariant,
  confidence: number,
): LaunchModalDraft {
  const buySol = useAutoLaunchStore.getState().launchBuySol;
  return {
    tweetSubject,
    tweetText: tweet.text,
    authorHandle: tweet.authorHandle,
    tweetUrl: tweet.tweetUrl ?? null,
    imageUrls: tweet.imageUrls ?? [],
    name: variant.suggestedName,
    symbol: variant.suggestedTicker,
    description: variant.narrative,
    launchpad: variant.suggestedLaunchpad,
    imageStrategy: variant.imageStrategy,
    launchBuySol: buySol,
    confidence,
    reasoning: variant.reasoning,
  };
}

function packageVariants(pkg: LaunchPackage): LaunchPackageVariant[] {
  if (pkg.variants?.length === 3) return [...pkg.variants];
  const base: LaunchPackageVariant = {
    suggestedName: pkg.suggestedName,
    suggestedTicker: pkg.suggestedTicker,
    narrative: pkg.narrative,
    suggestedLaunchpad: pkg.suggestedLaunchpad,
    imageStrategy: pkg.imageStrategy,
    reasoning: pkg.reasoning,
  };
  return [base, base, base];
}

export function openLaunchFromPackage(
  tweetSubject: string,
  tweet: TweetLaunchInput,
  pkg: LaunchPackage,
  variantIndex = 0,
): void {
  const variants = packageVariants(pkg);
  const variant = variants[variantIndex] ?? variants[0]!;
  useLaunchModalStore.getState().openWithDraft(variantToDraft(tweetSubject, tweet, variant, pkg.confidence));
}

/** Open launch modal with tweet context only (no AI package yet). */
export function openLaunchFromTweet(tweetSubject: string, tweet: TweetLaunchInput): void {
  const buySol = useAutoLaunchStore.getState().launchBuySol;
  useLaunchModalStore.getState().openWithDraft({
    tweetSubject,
    tweetText: tweet.text,
    authorHandle: tweet.authorHandle,
    tweetUrl: tweet.tweetUrl ?? null,
    imageUrls: tweet.imageUrls ?? [],
    name: '',
    symbol: '',
    description: tweet.text.slice(0, 500),
    launchpad: 'pump.fun',
    imageStrategy: tweet.imageUrls?.[0] ? 'use_tweet_image' : 'no_image',
    launchBuySol: buySol,
    confidence: 0,
    reasoning: '',
  });
}

/** Open the deploy panel from a suggestion card's N/T badge — prefill the
 *  suggestion's name + ticker and focus the chosen field for a quick edit. */
export function openLaunchFromSuggestion(
  tweetSubject: string,
  tweet: TweetLaunchInput,
  suggestion: { name: string; ticker: string },
  focusField: 'name' | 'ticker',
): void {
  const buySol = useAutoLaunchStore.getState().launchBuySol;
  useLaunchModalStore.getState().openWithDraft({
    tweetSubject,
    tweetText: tweet.text,
    authorHandle: tweet.authorHandle,
    tweetUrl: tweet.tweetUrl ?? null,
    imageUrls: tweet.imageUrls ?? [],
    name: suggestion.name,
    symbol: suggestion.ticker.replace(/^\$/, '').toUpperCase(),
    description: tweet.text.slice(0, 500),
    launchpad: 'pump.fun',
    imageStrategy: tweet.imageUrls?.[0] ? 'use_tweet_image' : 'no_image',
    launchBuySol: buySol,
    confidence: 0,
    reasoning: '',
    focusField,
  });
}

export function openDeployForTweet(
  tweetSubject: string,
  tweet: TweetLaunchInput,
  pkg: LaunchPackage | null | undefined,
  variantIndex = 0,
): void {
  if (pkg?.shouldLaunch) {
    openLaunchFromPackage(tweetSubject, tweet, pkg, variantIndex);
    return;
  }
  openLaunchFromTweet(tweetSubject, tweet);
}

/** Fetch AI package when needed, then open deploy modal. */
export async function openDeployForTweetAsync(
  tweetSubject: string,
  tweet: TweetLaunchInput,
  useAi: boolean,
  variantIndex = 0,
): Promise<void> {
  if (!useAi) {
    openLaunchFromTweet(tweetSubject, tweet);
    return;
  }
  openLaunchFromTweet(tweetSubject, tweet);
  try {
    const res = await fetch('/api/ai/launch-package', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tweet }),
    });
    if (res.ok) {
      const json = (await res.json()) as { package?: LaunchPackage };
      if (json.package?.shouldLaunch) {
        openLaunchFromPackage(tweetSubject, tweet, json.package, variantIndex);
        return;
      }
    }
  } catch {
    /* modal already open with manual draft */
  }
}
