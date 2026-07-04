import 'server-only';

import { getTokenByMint } from '@/lib/db/tokens';
import { grokComplete, grokConfigured } from '@/lib/ai/xaiGrok';

/**
 * 24-hour X-native narrative for a token, powered by Grok live search. This is the
 * "why did $ANSEM run" story — catalyst + sentiment grounded in real recent posts,
 * which the on-chain explainToken pipeline can't produce. Cached briefly so repeat
 * hovers are instant and cheap. Returns null when Grok isn't configured so callers
 * fall back to explainToken.
 */

export type TokenNarrative = { narrative: string; model: 'grok'; cached: boolean; generatedAt: number };

const CACHE_TTL_MS = 10 * 60_000;
const cache = new Map<string, { at: number; value: TokenNarrative }>();

export function tokenNarrativeAvailable(): boolean {
  return grokConfigured();
}

export async function tokenNarrative(mint: string, nowMs: number): Promise<TokenNarrative | null> {
  if (!grokConfigured()) return null;

  const hit = cache.get(mint);
  if (hit && nowMs - hit.at < CACHE_TTL_MS) {
    return { ...hit.value, cached: true };
  }

  let symbol: string | null = null;
  let name: string | null = null;
  try {
    const tok = await getTokenByMint(mint);
    symbol = tok?.symbol ?? null;
    name = tok?.name ?? null;
  } catch {
    /* proceed with mint only */
  }

  const anchor = symbol ? `$${symbol}` : mint.slice(0, 8);
  const from = new Date(nowMs - 24 * 3600_000).toISOString().slice(0, 10);

  const text = await grokComplete(
    [
      {
        role: 'system',
        content:
          "You are Pointer's market-narrative analyst embedded in X/Twitter. In 3-4 tight sentences, recap the LAST 24 HOURS for a Solana token, grounded in real recent X posts. Cover: the price / market-cap move, the specific catalyst(s) driving it (news, KOL calls, launches, broader Solana-ecosystem context), and the overall sentiment (bullish/bearish/mixed). Be factual and concrete — name the catalysts. No hype, no financial advice, no emojis, no disclaimers. If there's genuinely nothing, say the last 24h were quiet for it.",
      },
      {
        role: 'user',
        content: `Token: ${anchor}${name ? ` (${name})` : ''}. Contract: ${mint} (Solana). Recap the last 24 hours.`,
      },
    ],
    { liveSearch: true, fromDateIso: from, maxTokens: 300, temperature: 0.5 },
  );

  if (!text) return null;
  const value: TokenNarrative = { narrative: text, model: 'grok', cached: false, generatedAt: nowMs };
  cache.set(mint, { at: nowMs, value });
  return value;
}
