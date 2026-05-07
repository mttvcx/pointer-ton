import 'server-only';

import { createHash } from 'node:crypto';
import { findAiResponseByCacheKey, insertAiResponse } from '@/lib/db/aiCache';
import { getRedis } from '@/lib/redis/client';
import { AI_CACHE_TTL } from '@/lib/utils/constants';
import type { Json } from '@/lib/supabase/types';
import type { PipelineId } from '@/lib/ai/schemas';

/**
 * Cache layout
 * ============
 *
 *   Redis  ai:{pipeline}:{input_hash}  ->  JSON envelope { response, modelUsed }
 *   DB     ai_responses                  one row per *miss* (cache_hit=false)
 *                                        + one row per Redis miss / DB hit
 *                                        when we backfill from `ai_responses`.
 */

export interface CacheEnvelope<T = unknown> {
  response: T;
  modelUsed: string;
}

export interface RecordCallInput {
  pipeline: PipelineId;
  inputHash: string;
  userId: string | null;
  modelUsed: string;
  costUsd: number;
  cacheHit: boolean;
  /** Validated structured response. */
  response: unknown;
}

export function hashInput(parts: Record<string, unknown>): string {
  const stable = JSON.stringify(parts, Object.keys(parts).sort());
  return createHash('sha256').update(stable).digest('hex').slice(0, 32);
}

export function cacheKey(pipeline: PipelineId, inputHash: string): string {
  return `ai:${pipeline}:${inputHash}`;
}

export function ttlForPipeline(pipeline: PipelineId): number {
  return AI_CACHE_TTL[pipeline];
}

/** Look up Redis first, then DB. Backfills Redis on a DB-only hit. */
export async function readFromCache<T>(
  pipeline: PipelineId,
  inputHash: string,
): Promise<CacheEnvelope<T> | null> {
  const key = cacheKey(pipeline, inputHash);
  const redis = getRedis();

  try {
    const raw = await redis.get<CacheEnvelope<T>>(key);
    if (raw) return raw;
  } catch (err) {
    console.warn('[ai-cache] redis get failed', err);
  }

  // DB fallback: lets us survive Redis cold starts / cache misses without
  // re-paying the model cost in the same TTL window.
  try {
    const row = await findAiResponseByCacheKey(key);
    if (row) {
      const ageMs = Date.now() - new Date(row.created_at).getTime();
      const ttl = ttlForPipeline(pipeline);
      if (ageMs <= ttl * 1000) {
        const env: CacheEnvelope<T> = {
          response: row.response as T,
          modelUsed: row.model_used,
        };
        try {
          await redis.set(key, JSON.stringify(env), { ex: ttl });
        } catch (err) {
          console.warn('[ai-cache] redis backfill set failed', err);
        }
        return env;
      }
    }
  } catch (err) {
    console.warn('[ai-cache] db lookup failed', err);
  }

  return null;
}

export async function writeToCache(
  pipeline: PipelineId,
  inputHash: string,
  envelope: CacheEnvelope,
): Promise<void> {
  const key = cacheKey(pipeline, inputHash);
  try {
    await getRedis().set(key, JSON.stringify(envelope), {
      ex: ttlForPipeline(pipeline),
    });
  } catch (err) {
    console.warn('[ai-cache] redis set failed', err);
  }
}

/** Persist one row to `ai_responses`. Best-effort; never throws. */
export async function recordCall(input: RecordCallInput): Promise<void> {
  try {
    await insertAiResponse({
      cache_key: cacheKey(input.pipeline, input.inputHash),
      pipeline: input.pipeline,
      input_hash: input.inputHash,
      user_id: input.userId,
      response: input.response as Json,
      model_used: input.modelUsed,
      cost_usd: input.costUsd,
      cache_hit: input.cacheHit,
    });
  } catch (err) {
    console.warn('[ai-cache] insertAiResponse failed', err);
  }
}
