import 'server-only';

import { MODEL_PRICING_USD_PER_MTOK, MODELS } from '@/lib/utils/constants';

export type ModelKey = keyof typeof MODEL_PRICING_USD_PER_MTOK;

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

/** Convert raw token counts to USD for a given priced model. */
export function priceUsage(model: ModelKey, usage: TokenUsage): number {
  const price = MODEL_PRICING_USD_PER_MTOK[model];
  const cost =
    (usage.inputTokens * price.input + usage.outputTokens * price.output) / 1_000_000;
  // Round to 6 decimals to keep the DB column tidy.
  return Math.max(0, Math.round(cost * 1_000_000) / 1_000_000);
}

/** Map a model id (the actual provider string) back to a `ModelKey`. */
export function modelIdToKey(modelId: string): ModelKey {
  if (modelId === MODELS.haiku) return 'haiku';
  if (modelId === MODELS.sonnet) return 'sonnet';
  if (modelId === MODELS.geminiFlash) return 'geminiFlash';
  if (modelId === MODELS.embedding) return 'embedding';
  // Unknown id: bill at Sonnet rates so cost ceilings remain conservative.
  return 'sonnet';
}
