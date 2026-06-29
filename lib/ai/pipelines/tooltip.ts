import 'server-only';

import { runCascade } from '@/lib/ai/cascade';
import { sanitizeForPrompt } from '@/lib/ai/promptSanitize';
import { TooltipOutputSchema, type TooltipOutput } from '@/lib/ai/schemas';

export interface TooltipInput {
  term: string;
  context?: string;
  userId: string;
}

const SYSTEM_PROMPT = [
  'You are Pointer, explaining trading and TON / memecoin terminology to a user.',
  'Reply with one sentence, max 25 words, plain language. No emojis. No "in summary".',
].join(' ');

/**
 * Lightweight one-liner explainer ("what is bonding curve?", "what is rug pull?").
 * Cached 24h - the cascade key uses term + context so the same lookup hits
 * across users.
 */
export async function tooltip(input: TooltipInput): Promise<{
  data: TooltipOutput;
  cacheHit: boolean;
  fromCache: boolean;
  modelUsed: string;
  costUsd: number;
}> {
  // term + context are user-supplied and this answer is cached across users by
  // term — sanitize so the same value shapes BOTH the prompt and the cache key
  // and can't break out of the quoted interpolation below.
  const term = sanitizeForPrompt(input.term, 80);
  const context = sanitizeForPrompt(input.context, 200) || null;
  if (!term) throw new Error('empty_term');

  const userPrompt = [
    `Explain the term "${term}" in the context of TON memecoin trading.`,
    context ? `Context: ${context}` : null,
    '',
    'Respond as JSON: { "text": string (<=200 chars) }',
  ]
    .filter(Boolean)
    .join('\n');

  const result = await runCascade({
    pipeline: 'tooltip',
    userId: input.userId,
    inputs: { term: term.toLowerCase(), context: context?.toLowerCase() ?? null },
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
  });

  return {
    data: result.data as TooltipOutput,
    cacheHit: result.cacheHit,
    fromCache: result.fromCache,
    modelUsed: result.modelUsed,
    costUsd: result.costUsd,
  };
}

export { TooltipOutputSchema };
