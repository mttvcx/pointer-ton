import 'server-only';

import type { NarrativeFacts, ProviderStatus } from '@/sibyl/data/providers/types';
import { sibylForceMock } from '@/sibyl/config';

/**
 * Grok / web search — narrative origin, off-platform spread (TikTok / Reels / news),
 * where a meta started. Grok is the pick for live X-grounded narrative; falls back
 * to a search provider. Key-gated stub.
 * Env: XAI_API_KEY (Grok, live search) OR SEARCH_API_KEY (generic web search).
 */
// NOTE: real Grok/search fetch is not wired yet — flip REAL_IMPL when it is.
const REAL_IMPL = false;

export function grokSearchStatus(): ProviderStatus {
  const configured = Boolean(process.env.XAI_API_KEY?.trim() || process.env.SEARCH_API_KEY?.trim());
  return {
    name: 'grok-or-search',
    configured: configured && REAL_IMPL && !sibylForceMock(),
    envVars: ['XAI_API_KEY', 'SEARCH_API_KEY'],
    note: REAL_IMPL ? 'Narrative origin + off-platform spread.' : 'Narrative origin + off-platform spread. Real fetch pending (mock).',
  };
}

export async function getNarrativeFacts(subject: string): Promise<NarrativeFacts> {
  if (!REAL_IMPL || sibylForceMock() || !(process.env.XAI_API_KEY?.trim() || process.env.SEARCH_API_KEY?.trim())) {
    return {
      name: subject || 'personality meta',
      stage: 'mid',
      origin: 'CT — a single influencer wallet seeded it, quote-tweets carried it',
      strengthening: true,
      spread: { x: 78, tiktok: 22, reels: 14, news: 5, telegram: 40 },
      summary:
        'Attention is real but concentrated on X. Off-platform (TikTok/Reels) is thin, so this reads as a CT/personality trade, not an organic mass runner yet.',
      source: 'grok:mock',
    };
  }
  // TODO: Grok live search (reuse pointer-ton lib/ai/xaiGrok) → structured narrative.
  return { name: subject, stage: 'unknown', origin: null, strengthening: null, spread: {}, summary: '', source: 'grok' };
}
