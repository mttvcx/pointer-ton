import 'server-only';

import { z } from 'zod';
import {
  getAnthropic,
  getGeminiFlash,
} from '@/lib/ai/clients';
import {
  hashInput,
  readFromCache,
  recordCall,
  writeToCache,
  type CacheEnvelope,
} from '@/lib/ai/cache';
import { modelIdToKey, priceUsage, type TokenUsage } from '@/lib/ai/cost';
import {
  PIPELINE_SCHEMAS,
  type PipelineId,
} from '@/lib/ai/schemas';
import {
  enforceRateLimit,
  ensureUnderCostCeiling,
  recordCost,
  QuotaError,
} from '@/lib/ai/quota';
import { awardPoints } from '@/lib/db/points';
import { MODELS, POINTS_SOURCES } from '@/lib/utils/constants';

/**
 * Single chokepoint for every LLM call in Pointer.
 *
 *   1. Authenticate (`userId` required) - awards points + bills against quota.
 *   2. Read cache (Redis -> DB backfill).
 *   3. Sliding-window rate limit + daily cost ceiling.
 *   4. Cascade:
 *        Gemini Flash (default)
 *          -> on JSON / schema failure: Claude Haiku 4.5
 *          -> on `mode: "deep"`: skip straight to Claude Sonnet 4.6
 *   5. Validate output with the pipeline's Zod schema.
 *   6. Persist to `ai_responses`, write Redis cache, increment cost,
 *      award user_points (best-effort), then return.
 */

export type CascadeMode = 'fast' | 'deep';

export interface CascadeInput<P extends PipelineId> {
  pipeline: P;
  /** Pointer user id (uuid). `null` aborts with 401-equivalent. */
  userId: string | null;
  /**
   * Stable, content-derived inputs. Hashed deterministically into the cache
   * key. Anything user-specific that should NOT cause cache misses across
   * users (e.g. ui locale) must be excluded.
   */
  inputs: Record<string, unknown>;
  systemPrompt: string;
  userPrompt: string;
  mode?: CascadeMode;
  /** Override the schema if the caller is intentionally targeting a wider shape. */
  outputSchema?: z.ZodTypeAny;
  /** Used by `narrateAlert` etc. to skip points awards on background jobs. */
  skipPointsAward?: boolean;
}

export interface CascadeResult<T> {
  pipeline: PipelineId;
  data: T;
  cacheHit: boolean;
  modelUsed: string;
  costUsd: number;
}

const POINTS_PER_AI_CALL = 1;

export async function runCascade<P extends PipelineId>(
  input: CascadeInput<P>,
): Promise<CascadeResult<z.infer<(typeof PIPELINE_SCHEMAS)[P]>>> {
  if (!input.userId) {
    throw new QuotaError('unauthenticated', 'AI cascade requires authenticated user');
  }
  const schema = (input.outputSchema ?? PIPELINE_SCHEMAS[input.pipeline]) as z.ZodTypeAny;
  const inputHash = hashInput({
    pipeline: input.pipeline,
    inputs: input.inputs,
    mode: input.mode ?? 'fast',
  });

  // 1. Cache lookup. We still record the hit row so analytics see traffic.
  const cached = (await readFromCache(input.pipeline, inputHash)) as
    | CacheEnvelope<z.infer<(typeof PIPELINE_SCHEMAS)[P]>>
    | null;
  if (cached) {
    await recordCall({
      pipeline: input.pipeline,
      inputHash,
      userId: input.userId,
      modelUsed: cached.modelUsed,
      costUsd: 0,
      cacheHit: true,
      response: cached.response,
    });
    return {
      pipeline: input.pipeline,
      data: cached.response,
      cacheHit: true,
      modelUsed: cached.modelUsed,
      costUsd: 0,
    };
  }

  // 2. Quota gates BEFORE we burn provider budget.
  await ensureUnderCostCeiling(input.userId);
  await enforceRateLimit(input.userId);

  const mode: CascadeMode = input.mode ?? 'fast';

  // 3. Run cascade with first-success-wins. Each step: call provider, parse JSON,
  //    validate. On any throw / validation fail, try the next step.
  type Step = { runner: () => Promise<{ raw: string; usage: TokenUsage; modelUsed: string }>; label: string };
  const steps: Step[] = [];
  if (mode === 'deep') {
    steps.push({ label: 'sonnet', runner: callSonnet(input.systemPrompt, input.userPrompt) });
  } else {
    steps.push({ label: 'gemini', runner: callGeminiFlash(input.systemPrompt, input.userPrompt) });
    steps.push({ label: 'haiku', runner: callHaiku(input.systemPrompt, input.userPrompt) });
  }

  let lastErr: unknown = new Error('cascade exhausted');
  for (const step of steps) {
    try {
      const out = await step.runner();
      const parsed = safeParseJson(out.raw);
      if (!parsed.ok) {
        lastErr = new Error(`json parse failed (${step.label})`);
        continue;
      }
      const validation = schema.safeParse(parsed.value);
      if (!validation.success) {
        lastErr = validation.error;
        continue;
      }

      const costUsd = priceUsage(modelIdToKey(out.modelUsed), out.usage);

      // Best-effort persistence. Order matters: cache + DB row first so a
      // dropped points/cost write never replays the model call.
      const envelope: CacheEnvelope = {
        response: validation.data,
        modelUsed: out.modelUsed,
      };
      await writeToCache(input.pipeline, inputHash, envelope);
      await recordCall({
        pipeline: input.pipeline,
        inputHash,
        userId: input.userId,
        modelUsed: out.modelUsed,
        costUsd,
        cacheHit: false,
        response: validation.data,
      });
      await recordCost(input.userId, costUsd);
      if (!input.skipPointsAward) {
        try {
          await awardPoints(input.userId, POINTS_SOURCES.aiCall, POINTS_PER_AI_CALL, {
            pipeline: input.pipeline,
            model: out.modelUsed,
            costUsd,
          });
        } catch {
          /* best-effort */
        }
      }

      return {
        pipeline: input.pipeline,
        data: validation.data as z.infer<(typeof PIPELINE_SCHEMAS)[P]>,
        cacheHit: false,
        modelUsed: out.modelUsed,
        costUsd,
      };
    } catch (err) {
      lastErr = err;
      continue;
    }
  }

  const message = lastErr instanceof Error ? lastErr.message : 'cascade failed';
  throw new Error(`ai_cascade_failed: ${message}`);
}

/* ---------------------------- provider runners --------------------------- */

const SYSTEM_JSON_GUARD =
  'Reply ONLY with a single minified JSON object that matches the schema described in the user message. No prose, no markdown, no code fences.';

function callGeminiFlash(systemPrompt: string, userPrompt: string) {
  return async () => {
    const model = getGeminiFlash();
    const res = await model.generateContent({
      systemInstruction: { role: 'system', parts: [{ text: `${systemPrompt}\n\n${SYSTEM_JSON_GUARD}` }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    });
    const usage = res.response.usageMetadata;
    return {
      raw: res.response.text(),
      usage: {
        inputTokens: usage?.promptTokenCount ?? estimateTokens(systemPrompt + userPrompt),
        outputTokens: usage?.candidatesTokenCount ?? 200,
      },
      modelUsed: MODELS.geminiFlash,
    };
  };
}

function callHaiku(systemPrompt: string, userPrompt: string) {
  return callAnthropic(MODELS.haiku, systemPrompt, userPrompt, 800);
}

function callSonnet(systemPrompt: string, userPrompt: string) {
  return callAnthropic(MODELS.sonnet, systemPrompt, userPrompt, 1200);
}

function callAnthropic(modelId: string, systemPrompt: string, userPrompt: string, maxTokens: number) {
  return async () => {
    const client = getAnthropic();
    const res = await client.messages.create({
      model: modelId,
      max_tokens: maxTokens,
      system: `${systemPrompt}\n\n${SYSTEM_JSON_GUARD}`,
      messages: [{ role: 'user', content: userPrompt }],
      temperature: 0.2,
    });
    const text = res.content
      .filter((b): b is { type: 'text'; text: string; citations: null } =>
        b.type === 'text',
      )
      .map((b) => b.text)
      .join('');
    return {
      raw: text,
      usage: {
        inputTokens: res.usage.input_tokens,
        outputTokens: res.usage.output_tokens,
      },
      modelUsed: modelId,
    };
  };
}

/* --------------------------------- utils --------------------------------- */

function safeParseJson(raw: string): { ok: true; value: unknown } | { ok: false } {
  const trimmed = raw.trim();
  // Strip ```json fences if a model leaks them despite the guard.
  const candidate = trimmed.startsWith('```')
    ? trimmed.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
    : trimmed;
  try {
    return { ok: true, value: JSON.parse(candidate) };
  } catch {
    return { ok: false };
  }
}

/** Rough estimate when a provider does not report token usage. */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
