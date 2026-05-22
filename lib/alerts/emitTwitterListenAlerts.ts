import 'server-only';

import { insertAlert } from '@/lib/db/alerts';
import { listActiveSolTwitterListenRules, updateAlertRule } from '@/lib/db/alertRules';
import { upsertTwitterIngestTweet } from '@/lib/db/twitterIngestTweets';
import { ALERT_TYPE_TWITTER_LISTEN } from '@/lib/alerts/alertRuleModel';
import {
  parseAutomationRuleFromRow,
  twitterListenViewFromAutomation,
  type ActivityFilter,
} from '@/lib/alerts/automationRuleModel';
import { hammingDistanceHex, imageHashesMatch } from '@/lib/image/perceptualHash';
import {
  hashTweetImageUrls,
  type TweetImageHashEntry,
} from '@/lib/image/perceptualHash.server';
import { normalizeTwitterHandle } from '@/lib/alerts/solMintFromText';
import {
  mintCandidatesFromTweetParts,
  pickTwitterListenMint,
} from '@/lib/alerts/twitterListenMintPick';
import { notifyUserWebPush } from '@/lib/push/notifyUser';

export type TwitterListenIngestTweet = {
  id: string;
  handle: string;
  text: string;
  urls?: string[];
  imageUrls?: string[];
  tweetUrl?: string;
  createdAt?: string;
  tweetKind?: 'tweet' | 'reply' | 'quote' | 'retweet';
};

const ruleLastFireMs = new Map<string, number>();

function activityAllowed(filter: ActivityFilter, kind?: TwitterListenIngestTweet['tweetKind']): boolean {
  if (!kind) return true;
  switch (kind) {
    case 'tweet':
      return filter.tweets;
    case 'reply':
      return filter.replies;
    case 'quote':
      return filter.quotes;
    case 'retweet':
      return filter.retweets;
    default:
      return true;
  }
}

function phraseHits(
  loweredText: string,
  phrases: string[],
  mode: 'substring' | 'whole_word',
): string[] {
  if (phrases.length === 0) return [];
  const hits: string[] = [];
  for (const raw of phrases) {
    const p = raw.trim().toLowerCase();
    if (!p) continue;
    if (mode === 'substring') {
      if (loweredText.includes(p)) hits.push(raw);
      continue;
    }
    const escaped = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    try {
      const re = new RegExp(`(^|[^a-z0-9_])(${escaped})([^a-z0-9_]|$)`, 'i');
      if (re.test(loweredText)) hits.push(raw);
    } catch {
      if (loweredText.includes(p)) hits.push(raw);
    }
  }
  return hits;
}

function serverAllowsAutoBuy(): boolean {
  return process.env.POINTER_TWITTER_AUTOBUY?.trim() === '1';
}

export async function emitTwitterListenAlerts(tweets: TwitterListenIngestTweet[]): Promise<number> {
  if (tweets.length === 0) return 0;
  try {
    const rules = await listActiveSolTwitterListenRules();
    if (rules.length === 0) return 0;

    let inserts = 0;
    const allowAutoBuy = serverAllowsAutoBuy();

    const tweetHashesById = new Map<string, TweetImageHashEntry[]>();

    for (const t of tweets) {
      const imageUrls = (t.imageUrls ?? []).filter(Boolean);
      if (imageUrls.length === 0) {
        tweetHashesById.set(t.id, []);
        continue;
      }
      const hashes = await hashTweetImageUrls(imageUrls);
      tweetHashesById.set(t.id, hashes);

      const handleNorm = normalizeTwitterHandle(t.handle);
      if (handleNorm) {
        try {
          await upsertTwitterIngestTweet({
            tweetId: t.id,
            authorHandle: handleNorm,
            text: t.text ?? '',
            imageUrls,
            imageHashes: hashes,
            tweetKind: t.tweetKind ?? null,
            tweetUrl: t.tweetUrl ?? null,
            rawJson: { imageUrls, tweetKind: t.tweetKind ?? null },
          });
        } catch (err) {
          console.warn('[twitter_listen] upsert tweet record failed:', err);
        }
      }
    }

    for (const t of tweets) {
      const handleNorm = normalizeTwitterHandle(t.handle);
      if (!handleNorm) continue;
      const imageUrls = (t.imageUrls ?? []).filter(Boolean);
      const tweetHashes = tweetHashesById.get(t.id) ?? [];
      const hasPostImages = imageUrls.length > 0;
      const { textCandidates, mediaCandidates } = mintCandidatesFromTweetParts(
        t.text ?? '',
        t.urls,
        imageUrls,
      );
      const lowered = `${t.text ?? ''}\n`.toLowerCase();

      for (const rule of rules) {
        const automation = parseAutomationRuleFromRow(rule);
        if (!automation) continue;
        const config = twitterListenViewFromAutomation(automation);
        if (!config) continue;

        if (!activityAllowed(config.activityFilter, t.tweetKind)) continue;

        const cooldownMs = Math.max(0, config.cooldownSeconds) * 1000;
        if (cooldownMs > 0) {
          const last = ruleLastFireMs.get(config.ruleId) ?? 0;
          if (Date.now() - last < cooldownMs) continue;
        }

        const watch = new Set(
          config.handles.map((h) => normalizeTwitterHandle(h)).filter(Boolean),
        );
        if (!watch.has(handleNorm)) continue;

        let matched: string[] = [];
        let imageMatchDistance: number | null = null;
        let imageMatchUrl: string | null = null;

        if (config.triggerType === 'image_match') {
          if (!config.targetImageHash || tweetHashes.length === 0) continue;
          let bestDist: number | null = null;
          let bestUrl: string | null = null;
          let ok = false;
          for (const entry of tweetHashes) {
            const d = hammingDistanceHex(entry.hash, config.targetImageHash);
            if (bestDist == null || d < bestDist) {
              bestDist = d;
              bestUrl = entry.url;
            }
            if (imageHashesMatch(entry.hash, config.targetImageHash, config.hammingThreshold)) {
              ok = true;
              imageMatchDistance = d;
              imageMatchUrl = entry.url;
              break;
            }
          }
          if (!ok) continue;
          if (imageMatchDistance == null) imageMatchDistance = bestDist;
          if (imageMatchUrl == null) imageMatchUrl = bestUrl;
          matched = ['image_match'];
        } else {
          matched =
            config.phrases.length === 0 ? [] : phraseHits(lowered, config.phrases, config.phraseMatch);
          if (config.phrases.length > 0 && matched.length === 0) continue;
        }

        const requested = config.execution;

        const { mint, mintCandidates } = pickTwitterListenMint(
          config.tweetImageMintMode,
          textCandidates,
          mediaCandidates,
          hasPostImages,
        );

        const wantsCover = Boolean(config.openWithTweetMedia && hasPostImages);
        const coverImageUrl = wantsCover ? imageUrls[0] ?? null : null;

        let execution: 'notify' | 'auto_buy' = 'notify';
        let autoHeldReason: string | null = null;

        if (requested === 'auto_buy') {
          if (!allowAutoBuy) {
            execution = 'notify';
            autoHeldReason = mint ? 'server_autobuy_disabled' : 'server_autobuy_disabled_missing_mint';
          } else if (!mint) {
            execution = 'notify';
            autoHeldReason = 'missing_mint';
          } else {
            execution = 'auto_buy';
          }
        }

        ruleLastFireMs.set(config.ruleId, Date.now());

        const summary =
          config.triggerType === 'image_match'
            ? `${config.ruleName}: Image match (d≤${config.hammingThreshold}) · @${handleNorm}`
            : execution === 'auto_buy'
              ? `${config.ruleName}: Auto-buy · ${mint!.slice(0, 8)}…`
              : requested === 'auto_buy' && autoHeldReason
                ? matched.length > 0
                  ? `${config.ruleName}: Auto-buy held (${autoHeldReason.replace(/_/g, ' ')}) · @${handleNorm}`
                  : `${config.ruleName}: Auto-buy held (${autoHeldReason.replace(/_/g, ' ')}) · @${handleNorm}`
                : matched.length > 0
                  ? `${config.ruleName}: Keyword hit — ${matched.slice(0, 3).join(', ')} · @${handleNorm}`
                  : `${config.ruleName}: Post · @${handleNorm}`;

        const actionSucceeded = execution === 'auto_buy' && mint != null;

        await insertAlert({
          user_id: config.userId,
          type: ALERT_TYPE_TWITTER_LISTEN,
          ai_narration: summary,
          payload: {
            message: summary,
            ruleId: config.ruleId,
            ruleName: config.ruleName,
            handle: handleNorm,
            tweetId: t.id,
            tweetText: t.text,
            tweetUrl: t.tweetUrl ?? null,
            matchedPhrases: matched,
            imageMatchDistance,
            imageMatchUrl,
            tweetImageHashes: tweetHashes,
            mint,
            mintCandidates,
            imageUrls,
            coverImageUrl,
            tweetImageMintMode: config.tweetImageMintMode ?? 'off',
            execution,
            requestedExecution: requested,
            buySolPreset: config.buySolPreset ?? null,
            maxSolPerDay: config.maxSolPerDay ?? null,
            slippageBps: config.slippageBps ?? null,
            cooldownSeconds: config.cooldownSeconds,
            disableAfterSuccess: config.disableAfterSuccess,
            autoHeldReason,
            flash: {
              enabled: config.flashEnabled,
              color: config.flashColor,
              size: config.flashSize,
            },
            audio: {
              enabled: config.audioEnabled,
              preset: config.audioPreset,
              url: config.audioUrl,
            },
          },
        });
        inserts += 1;

        if (config.disableAfterSuccess && actionSucceeded) {
          try {
            await updateAlertRule(config.userId, config.ruleId, { is_active: false });
          } catch {
            /* best-effort */
          }
        }

        try {
          await notifyUserWebPush(config.userId, {
            title: `@${handleNorm}`,
            body: mint ? `${summary}` : summary,
            url: mint ? `/token/${encodeURIComponent(mint)}` : '/pulse',
          });
        } catch {
          /* best-effort */
        }
      }
    }

    return inserts;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[twitter_listen] emitTwitterListenAlerts failed:', msg);
    return 0;
  }
}
