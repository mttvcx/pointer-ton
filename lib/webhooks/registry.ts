import 'server-only';

import { processHeliusWebhookBody } from '@/lib/helius/webhooks';
import type { WebhookProcessor } from '@/lib/webhooks/runner';

/**
 * Provider → processor map. The retry drain cron and any replay path look the
 * processor up here, so adding a new inbound webhook is: (1) a route that ACKs +
 * enqueues, (2) an entry here. Each processor MUST be idempotent — it can run
 * more than once for the same signature (retries, replays).
 */
export const WEBHOOK_PROCESSORS: Record<string, WebhookProcessor> = {
  helius: (job) => processHeliusWebhookBody(job.payload, { source: 'helius', signature: job.signature }),
};

export const WEBHOOK_PROVIDERS = Object.keys(WEBHOOK_PROCESSORS);
