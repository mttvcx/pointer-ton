import 'server-only';

import webpush from 'web-push';
import {
  deletePushSubscriptionByEndpoint,
  listPushSubscriptionsForUser,
} from '@/lib/db/pushSubscriptions';
import { configureWebPushIfNeeded } from '@/lib/push/vapid';

export interface WebPushPayload {
  title: string;
  body: string;
  /** Open this path (relative, e.g. /token/...) when the notification is clicked. */
  url?: string;
}

/**
 * Best-effort fan-out to every stored subscription for the user.
 * Deletes subscriptions that return 404/410 from the push service.
 */
export async function notifyUserWebPush(userId: string, message: WebPushPayload): Promise<void> {
  if (!configureWebPushIfNeeded()) return;

  let subs;
  try {
    subs = await listPushSubscriptionsForUser(userId);
  } catch {
    return;
  }
  if (subs.length === 0) return;

  const payload = JSON.stringify({
    title: message.title,
    body: message.body,
    url: message.url ?? '/pulse',
  });

  await Promise.allSettled(
    subs.map(async (row) => {
      const sub = {
        endpoint: row.endpoint,
        keys: { p256dh: row.p256dh, auth: row.auth },
      };
      try {
        await webpush.sendNotification(sub, payload, { TTL: 86_400 });
      } catch (err: unknown) {
        const status = typeof err === 'object' && err && 'statusCode' in err ? (err as { statusCode: number }).statusCode : null;
        if (status === 404 || status === 410) {
          try {
            await deletePushSubscriptionByEndpoint(userId, row.endpoint);
          } catch {
            /* ignore */
          }
        }
      }
    }),
  );
}
