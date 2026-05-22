import 'server-only';

import { getRedis } from '@/lib/redis/client';

const WEBHOOK_DEDUP_TTL_SEC = 60;

function webhookDedupKey(signature: string): string {
  return `webhook:sig:${signature}`;
}

/** Returns false when another worker already claimed this signature within the TTL window. */
export async function claimHeliusWebhookSignature(signature: string): Promise<boolean> {
  const key = webhookDedupKey(signature);
  const claimed = await getRedis().set(key, '1', { ex: WEBHOOK_DEDUP_TTL_SEC, nx: true });
  return claimed != null;
}
