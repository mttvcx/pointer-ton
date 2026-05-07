import 'server-only';
import { timingSafeEqual } from 'node:crypto';
import { emitGlobalPulseNewTokenAlert } from '@/lib/alerts/generate';
import { insertAlert } from '@/lib/db/alerts';
import { notifyUserWebPush } from '@/lib/push/notifyUser';
import {
  listEnabledTrackerRulesForWallet,
} from '@/lib/db/trackerRules';
import { getTokenByMint, updateToken, upsertToken } from '@/lib/db/tokens';
import { getTrackedWallet, listUserIdsTrackingWallet } from '@/lib/db/wallets';
import { upsertWebhookEvent } from '@/lib/db/webhooks';
import type { LaunchpadEvent } from '@/lib/helius/parsers';
import { parseEnhancedTransaction } from '@/lib/helius/parsers';
import { ruleMatchesTokenLaunch } from '@/lib/trackers/evaluateRules';
import { parseRuleCondition } from '@/lib/trackers/ruleCondition';
import type { Json, TablesInsert } from '@/lib/supabase/types';

/** Constant-time compare for webhook auth header. */
export function verifyHeliusWebhookAuthorization(
  headerValue: string | null,
  expectedToken: string | undefined,
): boolean {
  if (!expectedToken || !headerValue) return false;
  const prefix = 'Bearer ';
  if (!headerValue.startsWith(prefix)) return false;
  const sent = headerValue.slice(prefix.length).trim();
  const a = Buffer.from(sent);
  const b = Buffer.from(expectedToken);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function eventToTokenInsert(ev: Readonly<LaunchpadEvent>): TablesInsert<'tokens'> {
  const now = new Date().toISOString();
  return {
    mint: ev.mint,
    symbol: ev.symbol,
    name: ev.name,
    decimals: 6,
    image_url: ev.image_url,
    creator_wallet: ev.creator_wallet,
    launch_pad: ev.launchpad === 'unknown' ? null : ev.launchpad,
    raw_metadata: ev.raw,
    initial_liquidity_sol: ev.initial_liquidity_sol,
    initial_liquidity_at: ev.initial_liquidity_sol != null ? now : null,
    created_at: now,
    last_seen_at: now,
  };
}

function normalizePayload(body: unknown): unknown[] {
  if (Array.isArray(body)) return body;
  if (body && typeof body === 'object' && Array.isArray((body as { data?: unknown[] }).data)) {
    return (body as { data: unknown[] }).data;
  }
  return [body];
}

/**
 * Process decoded Helius webhook JSON. Persists webhook_events, upserts tokens,
 * and notifies users tracking the creator wallet.
 */
export async function processHeliusWebhookBody(
  body: unknown,
  meta: { source: string; signature: string },
): Promise<{ events: number; tokensUpserted: number; alerts: number }> {
  await upsertWebhookEvent({
    signature: meta.signature,
    source: meta.source,
    payload: JSON.parse(JSON.stringify(body)) as Json,
    processed_at: new Date().toISOString(),
  });

  const txs = normalizePayload(body);
  let events = 0;
  let tokensUpserted = 0;
  let alerts = 0;

  for (const tx of txs) {
    const ev = parseEnhancedTransaction(tx);
    if (!ev) continue;
    events += 1;

    const existing = await getTokenByMint(ev.mint);
    const now = new Date().toISOString();
    if (existing) {
      await updateToken(ev.mint, {
        last_seen_at: now,
        raw_metadata: ev.raw,
        symbol: ev.symbol ?? existing.symbol,
        name: ev.name ?? existing.name,
        image_url: ev.image_url ?? existing.image_url,
        creator_wallet: ev.creator_wallet ?? existing.creator_wallet,
      });
    } else {
      await upsertToken(eventToTokenInsert(ev));
      await emitGlobalPulseNewTokenAlert({
        mint: ev.mint,
        symbol: ev.symbol,
        name: ev.name,
        launchpad: ev.launchpad === 'unknown' ? null : ev.launchpad,
        source: 'helius_webhook',
        creator_wallet: ev.creator_wallet,
        tx_signature: meta.signature,
        initial_liquidity_sol: ev.initial_liquidity_sol,
      });
    }
    tokensUpserted += 1;

    const wallet = ev.creator_wallet;
    if (wallet) {
      const userIds = await listUserIdsTrackingWallet(wallet);
      for (const userId of userIds) {
        const tracked = await getTrackedWallet(userId, wallet);
        if (!tracked) continue;

        const rules = await listEnabledTrackerRulesForWallet(tracked.id);
        const launchPadNorm =
          ev.launchpad === 'unknown' || !ev.launchpad ? null : String(ev.launchpad);

        if (rules.length > 0) {
          for (const rule of rules) {
            const cond = parseRuleCondition(rule.condition);
            if (!cond) continue;
            if (
              ruleMatchesTokenLaunch(cond, {
                mint: ev.mint,
                launchpad: launchPadNorm,
              })
            ) {
              await insertAlert({
                user_id: userId,
                type: 'tracker_rule',
                payload: {
                  message: rule.summary,
                  ruleId: rule.id,
                  mint: ev.mint,
                  wallet,
                  symbol: ev.symbol ?? null,
                  nlText: rule.nl_text,
                  launchpad: ev.launchpad,
                  signature: meta.signature,
                },
              });
              const ruleSym = ev.symbol ? `$${ev.symbol}` : ev.mint.slice(0, 8);
              await notifyUserWebPush(userId, {
                title: 'Tracker match',
                body: `${rule.summary} · ${ruleSym}`,
                url: `/token/${encodeURIComponent(ev.mint)}`,
              });
              alerts += 1;
            }
          }
        } else {
          await insertAlert({
            user_id: userId,
            type: 'tracked_wallet_launch',
            payload: {
              mint: ev.mint,
              symbol: ev.symbol ?? null,
              launchpad: ev.launchpad,
              signature: meta.signature,
              wallet,
            },
          });
          const launchSym = ev.symbol ? `$${ev.symbol}` : ev.mint.slice(0, 8);
          await notifyUserWebPush(userId, {
            title: 'Tracked wallet launched',
            body: launchSym,
            url: `/token/${encodeURIComponent(ev.mint)}`,
          });
          alerts += 1;
        }
      }
    }
  }

  return { events, tokensUpserted, alerts };
}
