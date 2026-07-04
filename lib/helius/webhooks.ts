import 'server-only';
import { timingSafeEqual } from 'node:crypto';
import { insertAlert } from '@/lib/db/alerts';
import { notifyUser } from '@/lib/push/notifyUser';
import {
  listEnabledTrackerRulesForWallet,
} from '@/lib/db/trackerRules';
import { getTrackedWallet, listUserIdsTrackingWallet } from '@/lib/db/wallets';
import { markTokenMigrated } from '@/lib/db/tokens';
import { extractChainObservedAt } from '@/lib/helius/chainTimestamp';
import { upsertWebhookEvent } from '@/lib/db/webhooks';
import { ingestWebhookMintFromPayload } from '@/lib/helius/webhookIngest';
import { parseMigrationTransaction } from '@/lib/helius/migrationParse';
import { parseEnhancedTransaction } from '@/lib/helius/parsers';
import { ruleMatchesTokenLaunch } from '@/lib/trackers/evaluateRules';
import { parseRuleCondition } from '@/lib/trackers/ruleCondition';
import type { Json } from '@/lib/supabase/types';
import { revalidatePulseFeedCache } from '@/lib/server/revalidatePulseFeed';
import { createAdminSupabase } from '@/lib/supabase/server';
import { processTrackedWalletTradeAlerts } from '@/lib/helius/trackedWalletTradeAlerts';
import {
  ingestQaSwapsFromEnhancedTxs,
  qaIndexerEnabled,
  type QaIngestReport,
} from '@/lib/indexer/qaMintIngest';

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

function normalizePayload(body: unknown): unknown[] {
  if (Array.isArray(body)) return body;
  if (body && typeof body === 'object' && Array.isArray((body as { data?: unknown[] }).data)) {
    return (body as { data: unknown[] }).data;
  }
  return [body];
}

function extractTxSignature(tx: unknown): string | null {
  const root = tx && typeof tx === 'object' && !Array.isArray(tx) ? (tx as Record<string, unknown>) : null;
  const sig = root?.signature;
  return typeof sig === 'string' && sig.length > 0 ? sig : null;
}

/**
 * Process decoded Helius webhook JSON. Persists webhook_events, upserts tokens,
 * and notifies users tracking the creator wallet.
 */
export async function processHeliusWebhookBody(
  body: unknown,
  meta: { source: string; signature: string },
): Promise<{
  events: number;
  tokensUpserted: number;
  alerts: number;
  migrations: number;
  trackedTrades: number;
  qaSwaps: QaIngestReport | null;
}> {
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
  let migrations = 0;
  let trackedTrades = 0;

  for (const tx of txs) {
    const txSignature = extractTxSignature(tx) ?? meta.signature;

    const tradeReport = await processTrackedWalletTradeAlerts(tx, txSignature);
    trackedTrades += tradeReport.alerts;
    alerts += tradeReport.alerts;

    const migration = parseMigrationTransaction(tx);
    if (migration) {
      migrations += 1;
      const migratedAt = extractChainObservedAt(migration.raw) ?? undefined;
      await markTokenMigrated(migration.mint, migration.destination, migratedAt);
    }

    const ev = parseEnhancedTransaction(tx);
    if (!ev) continue;
    events += 1;

    const upserted = await ingestWebhookMintFromPayload(ev, {
      alertSource: 'helius_webhook',
      txSignature,
    });
    tokensUpserted += upserted;

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
                  signature: txSignature,
                },
              });
              const ruleSym = ev.symbol ? `$${ev.symbol}` : ev.mint.slice(0, 8);
              await notifyUser(userId, {
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
              signature: txSignature,
              wallet,
            },
          });
          const launchSym = ev.symbol ? `$${ev.symbol}` : ev.mint.slice(0, 8);
          await notifyUser(userId, {
            title: 'Tracked wallet launched',
            body: launchSym,
            url: `/token/${encodeURIComponent(ev.mint)}`,
          });
          alerts += 1;
        }
      }
    }
  }

  let qaSwaps: QaIngestReport | null = null;
  if (qaIndexerEnabled()) {
    try {
      const supabase = createAdminSupabase();
      qaSwaps = await ingestQaSwapsFromEnhancedTxs(supabase, txs, {
        swapSource: 'helius_webhook',
        recomputeStats: true,
      });
      if (qaSwaps.swapsInserted > 0) {
        console.info('[helius-webhook] qa mint swaps ingested', {
          inserted: qaSwaps.swapsInserted,
          duplicates: qaSwaps.swapsSkippedDuplicate,
          parsed: qaSwaps.swapsParsed,
          failures: qaSwaps.parserFailures,
        });
      }
    } catch (err) {
      console.warn('[helius-webhook] qa mint swap ingest failed', err);
    }
  }

  if (tokensUpserted > 0 || migrations > 0) {
    revalidatePulseFeedCache();
  }

  return { events, tokensUpserted, alerts, migrations, trackedTrades, qaSwaps };
}
