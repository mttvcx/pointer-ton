import 'server-only';

import { getOpenAI } from '@/lib/ai/clients';
import { priceUsage } from '@/lib/ai/cost';
import { MODELS } from '@/lib/utils/constants';

export interface EmbeddingResult {
  vector: number[];
  modelUsed: string;
  costUsd: number;
}

/**
 * Wrap OpenAI text-embedding-3-small. Returns a single 1536-dim vector and
 * priced cost (output tokens are 0 for embeddings, so this is input-only).
 */
export async function embedText(input: string): Promise<EmbeddingResult> {
  const client = getOpenAI();
  const res = await client.embeddings.create({
    model: MODELS.embedding,
    input,
  });
  const vector = res.data[0]?.embedding ?? [];
  const usage = res.usage;
  return {
    vector,
    modelUsed: MODELS.embedding,
    costUsd: priceUsage('embedding', {
      inputTokens: usage?.prompt_tokens ?? Math.ceil(input.length / 4),
      outputTokens: 0,
    }),
  };
}

export async function embedBatch(inputs: string[]): Promise<EmbeddingResult[]> {
  if (inputs.length === 0) return [];
  const client = getOpenAI();
  const res = await client.embeddings.create({
    model: MODELS.embedding,
    input: inputs,
  });
  const totalInputTokens = res.usage?.prompt_tokens ?? inputs.reduce((s, t) => s + Math.ceil(t.length / 4), 0);
  // Charge proportionally per item so per-call accounting stays fair.
  const perItemTokens = Math.max(1, Math.round(totalInputTokens / inputs.length));
  const perItemCost = priceUsage('embedding', { inputTokens: perItemTokens, outputTokens: 0 });

  return res.data.map((row) => ({
    vector: row.embedding,
    modelUsed: MODELS.embedding,
    costUsd: perItemCost,
  }));
}
