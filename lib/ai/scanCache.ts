import 'server-only';

/**
 * Shared global AI scan cache (cross-user).
 *
 * - Keys: `{type}:{subject}:{bucket}` — public on-chain / tweet data only.
 * - Never cache user-specific fields (holdings, positions, wallet labels tied to viewer).
 * - All LLM routes must go through `runCascade` (which uses this layer) or `withAiCache`.
 * - Redis hot path + `ai_scan_cache` table for durability / admin stats.
 */

import {
  buildScanCacheKey,
  hashContext,
  type AiScanType,
  type BuildScanCacheKeyInput,
} from '@/lib/ai/scanCacheKeys';
import type { CacheEnvelope } from '@/lib/ai/cache';
import {
  deleteAiScanCacheRow,
  getAiScanCacheRow,
  incrementAiScanCacheHit,
  upsertAiScanCacheRow,
} from '@/lib/db/aiScanCache';
import { getRedis } from '@/lib/redis/client';
import { AI_SCAN_CACHE_TTL, AI_SCAN_MC_INVALIDATION } from '@/lib/utils/constants';
import type { PipelineId } from '@/lib/ai/schemas';

export interface ScanCacheContext {
  marketCapUsd?: number | null;
  surface?: 'hover' | 'copilot';
  walletActivityFingerprint?: string | null;
  sourceMint?: string | null;
  sourceWallet?: string | null;
  /** For narrative scans — mint from alert payload. */
  narrativeMint?: string | null;
}

export interface ScanCacheSpec extends BuildScanCacheKeyInput {
  ttlSeconds?: number;
  mcInvalidationPct?: number;
  sourceMint?: string | null;
  sourceWallet?: string | null;
}

export interface ScanCacheResult<T> extends CacheEnvelope<T> {
  fromCache: boolean;
  cacheKey: string;
}

function ttlForType(type: AiScanType): number {
  return AI_SCAN_CACHE_TTL[type];
}

function mcInvalidationForType(type: AiScanType): number | null {
  const pct = AI_SCAN_MC_INVALIDATION[type as keyof typeof AI_SCAN_MC_INVALIDATION];
  return pct ?? null;
}

function isMcStale(
  mcAtScan: number | null | undefined,
  currentMc: number | null | undefined,
  threshold: number,
): boolean {
  if (mcAtScan == null || currentMc == null) return false;
  if (!Number.isFinite(mcAtScan) || !Number.isFinite(currentMc) || mcAtScan <= 0) {
    return false;
  }
  return Math.abs(currentMc - mcAtScan) / mcAtScan > threshold;
}

async function readRedisEnvelope<T>(cacheKey: string): Promise<CacheEnvelope<T> | null> {
  try {
    return (await getRedis().get<CacheEnvelope<T>>(cacheKey)) ?? null;
  } catch (err) {
    console.warn('[ai-scan-cache] redis get failed', err);
    return null;
  }
}

async function writeRedisEnvelope(
  cacheKey: string,
  envelope: CacheEnvelope,
  ttlSeconds: number,
): Promise<void> {
  try {
    await getRedis().set(cacheKey, JSON.stringify(envelope), { ex: ttlSeconds });
  } catch (err) {
    console.warn('[ai-scan-cache] redis set failed', err);
  }
}

async function deleteRedisKey(cacheKey: string): Promise<void> {
  try {
    await getRedis().del(cacheKey);
  } catch {
    /* best-effort */
  }
}

export async function readScanCache<T>(spec: ScanCacheSpec): Promise<ScanCacheResult<T> | null> {
  const cacheKey = buildScanCacheKey(spec);
  const ttl = spec.ttlSeconds ?? ttlForType(spec.type);
  const mcThreshold = spec.mcInvalidationPct ?? mcInvalidationForType(spec.type);

  let row: Awaited<ReturnType<typeof getAiScanCacheRow>> = null;
  try {
    row = await getAiScanCacheRow(cacheKey);
  } catch (err) {
    console.warn('[ai-scan-cache] db get failed', err);
  }

  if (row) {
    if (new Date(row.expires_at).getTime() <= Date.now()) {
      await deleteScanCache(cacheKey);
      row = null;
    } else if (
      mcThreshold != null &&
      isMcStale(row.mc_at_scan, spec.marketCapUsd ?? null, mcThreshold)
    ) {
      await deleteScanCache(cacheKey);
      row = null;
    } else {
      const env: CacheEnvelope<T> = {
        response: row.result as T,
        modelUsed: row.model_used,
      };
      await writeRedisEnvelope(cacheKey, env, ttl);
      await incrementAiScanCacheHit(cacheKey);
      return { ...env, fromCache: true, cacheKey };
    }
  }

  const redisHit = await readRedisEnvelope<T>(cacheKey);
  if (redisHit) {
    await incrementAiScanCacheHit(cacheKey);
    return { ...redisHit, fromCache: true, cacheKey };
  }

  return null;
}

export async function writeScanCache<T>(
  spec: ScanCacheSpec,
  envelope: CacheEnvelope<T>,
): Promise<string> {
  const cacheKey = buildScanCacheKey(spec);
  const ttl = spec.ttlSeconds ?? ttlForType(spec.type);
  const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();

  const sourceMint =
    spec.sourceMint ??
    (spec.type === 'token_scan' ||
    spec.type === 'copilot' ||
    spec.type === 'narrative'
      ? spec.subject
      : null);

  await writeRedisEnvelope(cacheKey, envelope, ttl);
  try {
    await upsertAiScanCacheRow({
      cache_key: cacheKey,
      result: envelope.response,
      model_used: envelope.modelUsed,
      expires_at: expiresAt,
      scan_type: spec.type,
      source_mint: sourceMint,
      source_wallet: spec.sourceWallet ?? (spec.type === 'wallet_intel' ? spec.subject : null),
      mc_at_scan: spec.marketCapUsd ?? null,
    });
  } catch (err) {
    console.warn('[ai-scan-cache] db upsert failed', err);
  }
  return cacheKey;
}

export async function deleteScanCache(cacheKey: string): Promise<void> {
  await deleteRedisKey(cacheKey);
  try {
    await deleteAiScanCacheRow(cacheKey);
  } catch (err) {
    console.warn('[ai-scan-cache] db delete failed', err);
  }
}

export interface WithAiCacheOptions<T> {
  spec: ScanCacheSpec;
  fn: () => Promise<CacheEnvelope<T>>;
}

export async function withAiCache<T>(opts: WithAiCacheOptions<T>): Promise<ScanCacheResult<T>> {
  const cached = await readScanCache<T>(opts.spec);
  if (cached) return cached;

  const envelope = await opts.fn();
  const cacheKey = await writeScanCache(opts.spec, envelope);
  return { ...envelope, fromCache: false, cacheKey };
}

export function scanCacheSpecForPipeline(
  pipeline: PipelineId,
  inputs: Record<string, unknown>,
  mode: 'fast' | 'deep',
  ctx: ScanCacheContext = {},
): ScanCacheSpec | null {
  switch (pipeline) {
    case 'explainToken': {
      const mint = String(inputs.mint ?? '');
      if (!mint) return null;
      const surface = ctx.surface ?? 'hover';
      const type: AiScanType = surface === 'copilot' ? 'copilot' : 'token_scan';
      return {
        type,
        subject: mint,
        mode,
        marketCapUsd: ctx.marketCapUsd,
        sourceMint: mint,
      };
    }
    case 'explainWallet': {
      const address = String(inputs.address ?? '');
      if (!address) return null;
      return {
        type: 'wallet_intel',
        subject: address,
        mode,
        contextHash: ctx.walletActivityFingerprint ?? String(inputs.sigCount ?? 'na'),
        sourceWallet: address,
      };
    }
    case 'tooltip': {
      const term = String(inputs.term ?? '');
      if (!term) return null;
      return {
        type: 'tooltip',
        subject: term,
        contextHash: hashContext({ ctx: inputs.context ?? null }),
      };
    }
    case 'narrateAlert': {
      const mint = ctx.narrativeMint ?? String(inputs.alertId ?? '');
      if (!mint) return null;
      return {
        type: 'narrative',
        subject: mint,
        sourceMint: ctx.narrativeMint ?? null,
      };
    }
    case 'parseTrackerRule':
      return {
        type: 'tracker_parse',
        subject: 'rule',
        contextHash: hashContext({
          nl: inputs.nl,
          wallet: inputs.wallet,
        }),
      };
    case 'launchPackage': {
      const subject = String(inputs.subject ?? '');
      if (!subject) return null;
      return {
        type: 'launch_package',
        subject,
        contextHash: hashContext({
          handle: inputs.handle,
          text: inputs.text,
          imageCount: inputs.imageCount,
        }),
      };
    }
    default:
      return null;
  }
}
