import 'server-only';

import { insertAlert } from '@/lib/db/alerts';
import { listActiveSolTwitterListenRules } from '@/lib/db/alertRules';
import {
  ALERT_TYPE_TWITTER_LISTEN,
  parseSolTwitterListenRuleConfig,
  type SolTwitterListenRuleConfig,
} from '@/lib/alerts/alertRuleModel';
import { extractSolMintCandidates, normalizeTwitterHandle } from '@/lib/alerts/solMintFromText';
import { notifyUserWebPush } from '@/lib/push/notifyUser';

export type TwitterListenIngestTweet = {
  id: string;
  handle: string;
  text: string;
  urls?: string[];
  tweetUrl?: string;
  createdAt?: string;
};

function phraseHits(
  loweredText: string,
  phrases: string[],
  mode: SolTwitterListenRuleConfig['phraseMatch'],
): string[] {
  if (phrases.length === 0) return [];
  const m = mode ?? 'substring';
  const hits: string[] = [];
  for (const raw of phrases) {
    const p = raw.trim().toLowerCase();
    if (!p) continue;
    if (m === 'substring') {
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

    for (const t of tweets) {
      const handleNorm = normalizeTwitterHandle(t.handle);
      if (!handleNorm) continue;
      const blob = `${t.text ?? ''}\n${(t.urls ?? []).join('\n')}`;
      const mintCandidates = extractSolMintCandidates(blob);
      const lowered = `${t.text ?? ''}\n`.toLowerCase();
      const mint = mintCandidates[0] ?? null;

      for (const rule of rules) {
        if (rule.rule_type !== 'sol_twitter_listen') continue;
        const config = parseSolTwitterListenRuleConfig(rule.rule_config);
        if (!config) continue;

        const watch = new Set(
          config.handles.map((h) => normalizeTwitterHandle(h)).filter(Boolean),
        );
        if (!watch.has(handleNorm)) continue;

        const matched =
          config.phrases.length === 0 ? [] : phraseHits(lowered, config.phrases, config.phraseMatch);

        if (config.phrases.length > 0 && matched.length === 0) continue;

        const requested = config.execution ?? 'notify';

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

        const summary =
          execution === 'auto_buy'
            ? `${rule.name}: auto-buy · ${mint!.slice(0, 8)}`
            : `${rule.name}: @${handleNorm}`;

        await insertAlert({
          user_id: rule.user_id,
          type: ALERT_TYPE_TWITTER_LISTEN,
          ai_narration: summary,
          payload: {
            message: summary,
            ruleId: rule.id,
            ruleName: rule.name,
            handle: handleNorm,
            tweetId: t.id,
            tweetText: t.text,
            tweetUrl: t.tweetUrl ?? null,
            matchedPhrases: matched,
            mint,
            mintCandidates,
            execution,
            requestedExecution: requested,
            buySolPreset: config.buySolPreset ?? null,
            maxSolPerDay: config.maxSolPerDay ?? null,
            slippageBps: config.slippageBps ?? null,
            autoHeldReason,
            flash: {
              enabled: rule.flash_enabled,
              color: rule.flash_color,
              size: rule.flash_size,
            },
            audio: {
              enabled: rule.audio_enabled,
              preset: rule.audio_preset,
              url: rule.audio_url,
            },
          },
        });
        inserts += 1;

        try {
          await notifyUserWebPush(rule.user_id, {
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
