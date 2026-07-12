import 'server-only';

import { runCascade } from '@/lib/ai/cascade';
import type { LaunchPackageOutput } from '@/lib/ai/schemas';
import { tweetLaunchCacheSubject } from '@/lib/launch/tweetLaunchSubject';
import { launchpadsForChain, type LaunchPackage, type TweetLaunchInput } from '@/lib/launch/types';
import { mapLaunchPackageOutput } from '@/lib/launch/mapLaunchPackageOutput';
import type { AppChainId } from '@/lib/chains/appChain';

const CHAIN_LABEL: Record<AppChainId, string> = {
  sol: 'Solana',
  eth: 'Ethereum',
  bnb: 'BNB Chain',
  base: 'Base',
  robinhood: 'Robinhood Chain',
  ton: 'TON',
};

export type GenerateLaunchPackageResult = {
  package: LaunchPackage;
  cacheHit: boolean;
  fromCache: boolean;
  modelUsed: string;
  cacheSubject: string;
};

/**
 * Analyze a tweet for memecoin launch potential. Results are cached globally
 * in `ai_scan_cache` (see `launch_package` scan type) — identical tweet inputs
 * return the same package for every user.
 */
export async function generateLaunchPackage(
  tweet: TweetLaunchInput,
  userId: string,
  chain: AppChainId = 'sol',
): Promise<GenerateLaunchPackageResult> {
  const subject = tweetLaunchCacheSubject(tweet);
  const handle = tweet.authorHandle.trim().replace(/^@/, '');
  const images = (tweet.imageUrls ?? []).filter(Boolean).slice(0, 4);

  const pads = launchpadsForChain(chain);
  const padList = pads.join(', ');
  const padGuidance =
    chain === 'sol'
      ? 'Use pump.fun for classic viral memes; bonk for BONK/LetsBonk culture; moonshot for Moonit-style curves; bags for fee-share / creator splits; heaven for fast permissionless launches; bonkers only when BONK-adjacent chaos fits.'
      : `Pick the launchpad that best fits the meme on ${CHAIN_LABEL[chain]}; default to ${pads[0]} unless another clearly fits better.`;

  const system = [
    `You are a ${CHAIN_LABEL[chain]} memecoin launch strategist for traders monitoring X (Twitter).`,
    'Given a tweet (text, author, optional images), decide if launching a new token is appropriate.',
    'Launch only when the tweet clearly signals a new coin, meme, product, or cultural moment worth tokenizing — not for generic news or unrelated posts.',
    `suggestedLaunchpad must be one of: ${padList}.`,
    padGuidance,
    'imageStrategy: use_tweet_image when a attached image fits as logo; generate when text-only but visual meme is needed; no_image when inappropriate or risky.',
    'suggestedTicker: uppercase, 2-10 chars, no $. suggestedName: max 32 chars.',
    'Respond ONLY with a single minified JSON object of EXACTLY this shape:',
    `{"shouldLaunch": <boolean>, "confidence": <number 0..1>, "reasoning": "<why / why not, <=600 chars>", "options": [{"suggestedName": "<=32 chars", "suggestedTicker": "UPPERCASE 2-10, no $", "narrative": "<=500 chars", "suggestedLaunchpad": "${pads.join('|')}", "imageStrategy": "use_tweet_image|generate|no_image", "reasoning": "<=500 chars"}]}`,
    'confidence MUST be a number between 0 and 1 (e.g. 0.82), never a word. Do NOT put suggestedName/suggestedTicker/suggestedLaunchpad/imageStrategy at the top level — they belong ONLY inside each options entry.',
    'When shouldLaunch is true, provide 1-3 ranked options (best first), each with a distinct name/ticker/angle.',
    'When shouldLaunch is false, options MUST be an empty array [].',
  ].join(' ');

  const user = [
    `Author: @${handle}`,
    tweet.tweetUrl ? `URL: ${tweet.tweetUrl}` : null,
    images.length > 0 ? `Images (${images.length}): ${images.join(', ')}` : 'Images: none',
    'Tweet text:',
    tweet.text.trim().slice(0, 3500),
  ]
    .filter(Boolean)
    .join('\n');

  const { data, cacheHit, fromCache, modelUsed } = await runCascade({
    pipeline: 'launchPackage',
    userId,
    inputs: {
      subject,
      chain,
      handle,
      text: tweet.text.trim().slice(0, 2000),
      imageCount: images.length,
    },
    systemPrompt: system,
    userPrompt: user,
    mode: 'fast',
  });

  return {
    package: mapLaunchPackageOutput(data as LaunchPackageOutput),
    cacheHit,
    fromCache,
    modelUsed,
    cacheSubject: subject,
  };
}
