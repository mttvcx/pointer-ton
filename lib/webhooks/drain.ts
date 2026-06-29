import 'server-only';

import { recordOpsMetric } from '@/lib/ops/events';
import { deadLetterDepth, dueRetryJobs, retryDepth } from '@/lib/webhooks/queue';
import { runWebhookJob } from '@/lib/webhooks/runner';
import { WEBHOOK_PROCESSORS, WEBHOOK_PROVIDERS } from '@/lib/webhooks/registry';

export type DrainProviderSummary = {
  processed: number;
  ok: number;
  retried: number;
  dead: number;
  retryDepth: number;
  dlqDepth: number;
};

/**
 * Drain due webhook retries for every provider. Idempotent and safe to run on a
 * schedule (every 1-2 min). Also records retry/DLQ depth gauges so the ops
 * dashboard can alert on a growing backlog. Per-provider failures are isolated.
 */
export async function runDrainWebhooks(
  nowMs: number = Date.now(),
  limitPerProvider = 50,
): Promise<Record<string, DrainProviderSummary>> {
  const summary: Record<string, DrainProviderSummary> = {};

  for (const provider of WEBHOOK_PROVIDERS) {
    const processor = WEBHOOK_PROCESSORS[provider]!;
    let ok = 0;
    let retried = 0;
    let dead = 0;
    let jobs: Awaited<ReturnType<typeof dueRetryJobs>> = [];
    try {
      jobs = await dueRetryJobs(provider, nowMs, limitPerProvider);
      for (const job of jobs) {
        const r = await runWebhookJob(job, processor, undefined, nowMs);
        if (r.ok) ok++;
        else if (r.action === 'dead') dead++;
        else retried++;
      }
    } catch {
      /* provider-level failure — leave its jobs for the next tick */
    }

    let rDepth = 0;
    let dDepth = 0;
    try {
      rDepth = await retryDepth(provider);
      dDepth = await deadLetterDepth(provider);
      void recordOpsMetric('webhook.retry.depth', rDepth, { provider });
      void recordOpsMetric('webhook.dlq.depth', dDepth, { provider });
    } catch {
      /* metrics best-effort */
    }

    summary[provider] = {
      processed: jobs.length,
      ok,
      retried,
      dead,
      retryDepth: rDepth,
      dlqDepth: dDepth,
    };
  }

  return summary;
}
