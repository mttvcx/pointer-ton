import 'server-only';

import { recordOpsEvent, recordOpsMetric } from '@/lib/ops/events';
import {
  clearRetry,
  deadLetter,
  scheduleRetry,
  type WebhookJob,
} from '@/lib/webhooks/queue';
import {
  DEFAULT_WEBHOOK_RETRY,
  decideRetry,
  jitterFromId,
  type WebhookRetryConfig,
} from '@/lib/webhooks/retryPolicy';

export type WebhookProcessor = (job: WebhookJob) => Promise<unknown>;

export type RunResult =
  | { ok: true; result: unknown }
  | { ok: false; action: 'retry' | 'dead'; error: string };

/**
 * Run one webhook job through its processor with full retry/DLQ semantics and
 * metrics. On success the job is cleared from the delay queue. On failure the
 * pure retry policy decides whether to reschedule (capped exponential backoff)
 * or dead-letter. Never throws — returns a structured result so the caller
 * (route `after()` or the drain cron) can keep going.
 */
export async function runWebhookJob(
  job: WebhookJob,
  processor: WebhookProcessor,
  cfg: WebhookRetryConfig = DEFAULT_WEBHOOK_RETRY,
  nowMs: number = Date.now(),
): Promise<RunResult> {
  const startedAt = Date.now();
  try {
    const result = await processor(job);
    await clearRetry(job.provider, job.id);
    await recordOpsMetric('webhook.process.ms', Date.now() - startedAt, {
      provider: job.provider,
      status: 'ok',
    });
    await recordOpsEvent({
      category: 'webhook',
      name: `${job.provider}:processed`,
      status: 'ok',
      durationMs: Date.now() - startedAt,
      detail: { signature: job.signature, attempt: job.attempt + 1 },
    });
    return { ok: true, result };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    const attempt = job.attempt + 1; // attempts made including this one
    const decision = decideRetry(attempt, nowMs, cfg, jitterFromId(job.id));
    const updated: WebhookJob = { ...job, attempt, lastError: error };

    await recordOpsMetric('webhook.process.ms', Date.now() - startedAt, {
      provider: job.provider,
      status: 'error',
    });

    if (decision.action === 'dead') {
      await deadLetter(updated);
      await recordOpsEvent({
        category: 'webhook',
        name: `${job.provider}:dead_letter`,
        status: 'error',
        severity: 'error',
        message: error,
        detail: { signature: job.signature, attempts: attempt },
      });
      return { ok: false, action: 'dead', error };
    }

    await scheduleRetry(updated, decision.dueAtMs);
    await recordOpsEvent({
      category: 'webhook',
      name: `${job.provider}:retry_scheduled`,
      status: 'warn',
      severity: 'warn',
      message: error,
      detail: { signature: job.signature, attempt, dueInMs: decision.delayMs },
    });
    return { ok: false, action: 'retry', error };
  }
}
