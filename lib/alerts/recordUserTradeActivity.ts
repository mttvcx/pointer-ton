import { ALERT_TYPE_USER_TRADE, type UserTradeAlertPayload } from '@/lib/alerts/userActivityAlerts';

/**
 * Inserts a row the Activity feed reads (same pipeline as alert rules / X listens).
 * Best-effort: failures are ignored so trading UX never blocks on notification logging.
 */
export async function recordUserTradeActivity(
  accessToken: string,
  narration: string,
  payload: UserTradeAlertPayload,
): Promise<boolean> {
  try {
    const res = await fetch('/api/alerts/record', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        type: ALERT_TYPE_USER_TRADE,
        narration: narration.slice(0, 500),
        payload,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
