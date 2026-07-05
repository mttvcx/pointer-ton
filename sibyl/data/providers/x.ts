import 'server-only';

import type { ProviderStatus, SocialFacts } from '@/sibyl/data/providers/types';
import { sibylForceMock } from '@/sibyl/config';

/**
 * X / Twitter — KOL posts, mentions, quote/reply velocity, CT sentiment. Env:
 * TWITTER_BEARER_TOKEN (shared with pointer-ton X monitor). Mock returns a
 * rising-velocity KOL set so SocialVelocityCard renders.
 * NOTE: the real search/recent fetch is not wired yet — flip REAL_IMPL when it is.
 */
const REAL_IMPL = false;

export function xStatus(): ProviderStatus {
  return {
    name: 'x',
    configured: Boolean(process.env.TWITTER_BEARER_TOKEN?.trim()) && REAL_IMPL && !sibylForceMock(),
    envVars: ['TWITTER_BEARER_TOKEN'],
    note: REAL_IMPL ? 'CT mentions + velocity.' : 'CT mentions + velocity. Key present; real fetch pending (mock).',
  };
}

export async function getSocialFacts(query: string): Promise<SocialFacts> {
  if (!REAL_IMPL || sibylForceMock() || !process.env.TWITTER_BEARER_TOKEN?.trim()) {
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
