import 'server-only';

import { getRedis } from '@/lib/redis/client';

/**
 * Durable webhook job queue + dead-letter queue over Redis.
 *
 * Flow: a webhook is ACKed immediately, then processed out of band. On failure
 * the job is scheduled onto a delay queue (ZSET scored by due-time) and retried
 * with exponential backoff by the drain cron; once attempts are exhausted it is
 * moved to a dead-letter list for inspection/manual replay. All keys are
 * namespaced per provider so each integration is isolated.
 *
 * Retry decisions are pure (`retryPolicy.ts`); this module is the I/O.
 */

export type WebhookJob = {
  id: string;
  provider: string;
  /** Idempotency key (the upstream event signature). */
  signature: string;
  payload: unknown;
  /** Attempts made so far (0 = enqueued, never tried). */
  attempt: number;
  firstSeenAt: number;
  lastError?: string | null;
};

const JOB_TTL_SEC = 7 * 24 * 60 * 60; // keep the blob 7 days
const DLQ_MAX = 1000; // soft cap; oldest dropped past this

const jobKey = (p: string, id: string) => `wh:job:${p}:${id}`;
const retryKey = (p: string) => `wh:retry:${p}`;
const dlqKey = (p: string) => `wh:dlq:${p}`;

/** Persist (or refresh) the job blob and schedule it on the delay queue. */
export async function scheduleRetry(job: WebhookJob, dueAtMs: number): Promise<void> {
  const redis = getRedis();
  await redis.set(jobKey(job.provider, job.id), JSON.stringify(job), { ex: JOB_TTL_SEC });
  await redis.zadd(retryKey(job.provider), { score: dueAtMs, member: job.id });
}

/** Jobs whose due-time has arrived (oldest-due first), up to `limit`. */
export async function dueRetryJobs(provider: string, nowMs: number, limit = 25): Promise<WebhookJob[]> {
  const redis = getRedis();
  const ids = await redis.zrangebyscore(retryKey(provider), '-inf', nowMs);
  const out: WebhookJob[] = [];
  for (const id of ids.slice(0, limit)) {
    const raw = await redis.get<string | WebhookJob>(jobKey(provider, id));
    if (raw == null) {
      // Blob expired/lost — drop the dangling schedule entry.
      await redis.zrem(retryKey(provider), id);
      continue;
    }
    out.push(typeof raw === 'string' ? (JSON.parse(raw) as WebhookJob) : raw);
  }
  return out;
}

/** Remove a job from the delay queue + drop its blob (call on success). */
export async function clearRetry(provider: string, id: string): Promise<void> {
  const redis = getRedis();
  await redis.zrem(retryKey(provider), id);
  await redis.del(jobKey(provider, id));
}

/** Number of jobs currently scheduled for retry. */
export async function retryDepth(provider: string): Promise<number> {
  return getRedis().zcard(retryKey(provider));
}

/** Move a job to the dead-letter queue (attempts exhausted). */
export async function deadLetter(job: WebhookJob): Promise<void> {
  const redis = getRedis();
  await redis.zrem(retryKey(job.provider), job.id);
  await redis.del(jobKey(job.provider, job.id));
  const key = dlqKey(job.provider);
  // Soft cap: drop the oldest if we're at the ceiling.
  if ((await redis.llen(key)) >= DLQ_MAX) await redis.rpop(key);
  await redis.lpush(key, JSON.stringify({ ...job, deadAt: Date.now() }));
}

export async function deadLetterDepth(provider: string): Promise<number> {
  return getRedis().llen(dlqKey(provider));
}

/** Newest-first view of the dead-letter queue (does not consume). */
export async function peekDeadLetters(provider: string, limit = 50): Promise<Array<WebhookJob & { deadAt?: number }>> {
  const rows = await getRedis().lrange(dlqKey(provider), 0, Math.max(0, limit - 1));
  const out: Array<WebhookJob & { deadAt?: number }> = [];
  for (const r of rows) {
    try {
      out.push(JSON.parse(r) as WebhookJob & { deadAt?: number });
    } catch {
      /* skip corrupt entry */
    }
  }
  return out;
}

/**
 * Move up to `limit` dead-lettered jobs back onto the retry queue, due now, with
 * attempt counter reset. Returns how many were requeued. Used by the admin
 * "replay" action.
 */
export async function replayDeadLetters(provider: string, nowMs: number, limit = 50): Promise<number> {
  const redis = getRedis();
  let moved = 0;
  for (let i = 0; i < limit; i++) {
    const raw = await redis.rpop(dlqKey(provider));
    if (raw == null) break;
    let job: WebhookJob;
    try {
      job = JSON.parse(raw) as WebhookJob;
    } catch {
      continue; // drop corrupt entry
    }
    await scheduleRetry({ ...job, attempt: 0, lastError: null }, nowMs);
    moved++;
  }
  return moved;
}
