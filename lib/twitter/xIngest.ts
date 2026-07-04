import 'server-only';

import { listActiveSolTwitterListenRules } from '@/lib/db/alertRules';
import {
  parseAutomationRuleFromRow,
  twitterListenViewFromAutomation,
} from '@/lib/alerts/automationRuleModel';
import { normalizeTwitterHandle } from '@/lib/alerts/solMintFromText';
import { getLatestIngestedTweetId, upsertTwitterIngestTweet } from '@/lib/db/twitterIngestTweets';
import { emitTwitterListenAlerts } from '@/lib/alerts/emitTwitterListenAlerts';
import { fetchRecentTweetsFromHandles, xApiConfigured } from '@/lib/twitter/xApiClient';
import { DEFAULT_MONITOR_HANDLES } from '@/lib/twitter/defaultKols';

export type XMonitorIngestResult = {
  ok: boolean;
  skipped?: 'no_token' | 'no_rules';
  handles?: number;
  fetched?: number;
  alerts?: number;
};

/**
 * X Monitor ingest tick. Watched handles come from every user's active
 * twitter-listen automation rule, so there's no separate KOL list to maintain —
 * arm a rule and its handles get polled. Dormant (no-op) until
 * TWITTER_BEARER_TOKEN is set. Fetches only tweets newer than the last ingested
 * id, then hands them to the existing alert/auto-buy/auto-launch engine.
 */
export async function runXMonitorIngest(): Promise<XMonitorIngestResult> {
  if (!xApiConfigured()) return { ok: true, skipped: 'no_token' };

  // Always poll the default KOL set so the feed streams out of the box; add every
  // user's active-rule handles on top.
  const handles = new Set<string>();
  for (const h of DEFAULT_MONITOR_HANDLES) {
    const n = normalizeTwitterHandle(h);
    if (n) handles.add(n);
  }
  const rules = await listActiveSolTwitterListenRules();
  for (const rule of rules) {
    const automation = parseAutomationRuleFromRow(rule);
    if (!automation) continue;
    const config = twitterListenViewFromAutomation(automation);
    if (!config) continue;
    for (const h of config.handles) {
      const n = normalizeTwitterHandle(h);
      if (n) handles.add(n);
    }
  }
  if (handles.size === 0) return { ok: true, skipped: 'no_rules' };

  const sinceId = await getLatestIngestedTweetId();
  const tweets = await fetchRecentTweetsFromHandles([...handles], sinceId);
  if (tweets.length === 0) return { ok: true, handles: handles.size, fetched: 0, alerts: 0 };

  // Store EVERY fetched tweet (incl. text-only) so the raw feed has them — the
  // alert pass below only persists image tweets (with perceptual hashes).
  await Promise.allSettled(
    tweets.map((t) => {
      const handle = normalizeTwitterHandle(t.handle);
      if (!handle) return Promise.resolve();
      return upsertTwitterIngestTweet({
        tweetId: t.id,
        authorHandle: handle,
        text: t.text,
        imageUrls: t.imageUrls,
        imageHashes: [],
        tweetKind: t.tweetKind,
        tweetUrl: t.tweetUrl,
        rawJson: null,
      }).catch(() => {});
    }),
  );

  const alerts = await emitTwitterListenAlerts(
    tweets.map((t) => ({
      id: t.id,
      handle: t.handle,
      text: t.text,
      imageUrls: t.imageUrls,
      tweetUrl: t.tweetUrl,
      createdAt: t.createdAt ?? undefined,
      tweetKind: t.tweetKind,
    })),
  );

  return { ok: true, handles: handles.size, fetched: tweets.length, alerts };
}
