import 'server-only';

import { deleteDevicePushToken, listDevicePushTokensForUser } from '@/lib/db/devicePushTokens';

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';

export interface ExpoPushMessage {
  title: string;
  body: string;
  /** Deep-link path or data payload the app reads on tap (e.g. /token/<mint>). */
  url?: string;
  data?: Record<string, unknown>;
}

/**
 * Best-effort Expo push fan-out to every device token stored for the user.
 * Drops tokens Expo reports as DeviceNotRegistered.
 */
export async function notifyUserExpo(userId: string, message: ExpoPushMessage): Promise<void> {
  let tokens;
  try {
    tokens = await listDevicePushTokensForUser(userId);
  } catch {
    return;
  }
  if (tokens.length === 0) return;

  const messages = tokens.map((t) => ({
    to: t.expoPushToken,
    title: message.title,
    body: message.body,
    sound: 'default' as const,
    data: { url: message.url ?? '/pulse', ...(message.data ?? {}) },
  }));

  let res: Response;
  try {
    res = await fetch(EXPO_PUSH_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(messages),
    });
  } catch {
    return;
  }
  if (!res.ok) return;

  // Reap dead tokens so we don't keep pushing to uninstalled apps.
  try {
    const json = (await res.json()) as { data?: Array<{ status: string; details?: { error?: string } }> };
    const receipts = json.data ?? [];
    await Promise.allSettled(
      receipts.map(async (receipt, i) => {
        if (receipt.status === 'error' && receipt.details?.error === 'DeviceNotRegistered') {
          const dead = messages[i]?.to;
          if (dead) await deleteDevicePushToken(dead);
        }
      }),
    );
  } catch {
    /* ignore receipt parsing */
  }
}
