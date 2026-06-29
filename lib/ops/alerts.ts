import 'server-only';

import { getRedis } from '@/lib/redis/client';
import {
  alertKey,
  buildAlertPayload,
  cooldownSeconds,
  shouldDispatch,
  type AlertEvent,
} from '@/lib/ops/alertDecisions';

/**
 * Outbound ops alerting. When an error/critical ops event fires (and auto-opens
 * an incident), push a Discord and/or Slack alert so a human is paged before
 * users notice. Deduped per incident key with a severity-scaled cooldown.
 *
 * Best-effort and NEVER throws — telemetry/alerting must not break the caller.
 * No-ops cleanly when no webhook is configured.
 */

const DISCORD_URL = () => process.env.OPS_DISCORD_WEBHOOK_URL?.trim() || null;
const SLACK_URL = () => process.env.OPS_SLACK_WEBHOOK_URL?.trim() || null;
const APP_URL = () => process.env.NEXT_PUBLIC_APP_URL?.trim() || undefined;

// In-process fallback so a Redis outage can't turn into an alert flood.
const localCooldown = new Map<string, number>();

/** Claim the cooldown window for this key. Returns true if THIS caller should
 *  send (first in the window). Redis-backed; falls back to in-process on error. */
async function claimCooldown(key: string, ttlSec: number): Promise<boolean> {
  try {
    const res = await getRedis().set(key, '1', { ex: ttlSec, nx: true });
    return res != null;
  } catch {
    const now = Date.now();
    const until = localCooldown.get(key) ?? 0;
    if (until > now) return false;
    localCooldown.set(key, now + ttlSec * 1000);
    return true;
  }
}

async function postJson(url: string, body: unknown): Promise<void> {
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    /* swallow — a failed alert must not break anything */
  }
}

/** Build + POST to every configured channel, bypassing the cooldown. Returns the
 *  channels attempted (so an admin test can confirm config). Never throws. */
export async function sendOpsAlertNow(ev: AlertEvent): Promise<{ channels: string[] }> {
  const channels: string[] = [];
  try {
    const discord = DISCORD_URL();
    const slack = SLACK_URL();
    if (!discord && !slack) return { channels };

    const p = buildAlertPayload(ev, APP_URL());
    const linkLine = p.opsUrl ? `\n${p.opsUrl}` : '';
    const sends: Promise<void>[] = [];
    if (discord) {
      channels.push('discord');
      sends.push(
        postJson(discord, {
          embeds: [
            {
              title: p.title.slice(0, 256),
              description: p.message,
              color: p.color,
              fields: p.detail ? [{ name: 'detail', value: `\`\`\`${p.detail}\`\`\``.slice(0, 1024) }] : undefined,
              url: p.opsUrl ?? undefined,
            },
          ],
        }),
      );
    }
    if (slack) {
      channels.push('slack');
      const text = `*${p.title}*\n${p.message}${p.detail ? `\n\`${p.detail}\`` : ''}${linkLine}`;
      sends.push(postJson(slack, { text }));
    }
    await Promise.all(sends);
  } catch {
    /* swallow */
  }
  return { channels };
}

/** Fire-and-forget ops alert. Call as `void dispatchOpsAlert(...)`. */
export async function dispatchOpsAlert(ev: AlertEvent): Promise<void> {
  try {
    if (!shouldDispatch(ev.status, ev.severity)) return;
    const discord = DISCORD_URL();
    const slack = SLACK_URL();
    if (!discord && !slack) return; // nothing configured

    const claimed = await claimCooldown(alertKey(ev.category, ev.name, ev.severity), cooldownSeconds(ev.severity));
    if (!claimed) return;

    const p = buildAlertPayload(ev, APP_URL());
    const linkLine = p.opsUrl ? `\n${p.opsUrl}` : '';

    const sends: Promise<void>[] = [];
    if (discord) {
      sends.push(
        postJson(discord, {
          embeds: [
            {
              title: p.title.slice(0, 256),
              description: p.message,
              color: p.color,
              fields: p.detail ? [{ name: 'detail', value: `\`\`\`${p.detail}\`\`\``.slice(0, 1024) }] : undefined,
              url: p.opsUrl ?? undefined,
            },
          ],
        }),
      );
    }
    if (slack) {
      const text = `*${p.title}*\n${p.message}${p.detail ? `\n\`${p.detail}\`` : ''}${linkLine}`;
      sends.push(postJson(slack, { text }));
    }
    await Promise.all(sends);
  } catch {
    /* swallow */
  }
}
