import 'server-only';

import type { ProviderStatus, SocialFacts } from '@/sibyl/data/providers/types';
import { sibylMockMode } from '@/sibyl/config';

/**
 * X / Twitter — KOL posts, mentions, quote/reply velocity, CT sentiment. Key-gated
 * stub. Env: TWITTER_BEARER_TOKEN (shared with pointer-ton X monitor). Mock returns
 * a rising-velocity KOL set so SocialVelocityCard renders.
 */
export function xStatus(): ProviderStatus {
  return {
    name: 'x',
    configured: Boolean(process.env.TWITTER_BEARER_TOKEN?.trim()) && !sibylMockMode(),
    envVars: ['TWITTER_BEARER_TOKEN'],
    note: 'CT mentions + velocity. Stubbed until the X plan is live.',
  };
}

export async function getSocialFacts(query: string): Promise<SocialFacts> {
  if (sibylMockMode() || !process.env.TWITTER_BEARER_TOKEN?.trim()) {
    return {
      velocity: 'rising',
      handleCount: 6,
      window: '6h',
      mentions: [
        { handle: 'cented7', name: 'Cented', note: 'called it early, still holding' },
        { handle: 'gh0stee', name: 'Ghost', note: 'quote-tweeted the chart' },
        { handle: 'ripjalens', name: 'Jalen', note: 'watching, no entry' },
      ],
      source: 'x:mock',
    };
  }
  // TODO: search/recent for the ticker/CA, aggregate handles + velocity.
  return { velocity: 'unknown', handleCount: 0, window: '6h', mentions: [], source: 'x' };
}
