import { ALERT_TYPE_TWITTER_LISTEN } from '@/lib/alerts/alertRuleModel';
import { tweetInputFromAlertPayload } from '@/lib/launch/alertTweet';
import { tweetLaunchCacheSubject } from '@/lib/launch/tweetLaunchSubject';

export type TwitterListenAutoLaunchPayload = {
  execution?: string;
  requestedExecution?: string;
  ruleId?: string;
  ruleName?: string;
  handle?: string;
  tweetText?: string;
  tweetUrl?: string | null;
  tweetId?: string;
  imageUrls?: string[];
  coverImageUrl?: string | null;
};

export function parseTwitterListenAutoLaunchPayload(
  payload: unknown,
): TwitterListenAutoLaunchPayload | null {
  if (!payload || typeof payload !== 'object') return null;
  return payload as TwitterListenAutoLaunchPayload;
}

export function isAutoLaunchTwitterListenAlert(type: string, payload: unknown): boolean {
  if (type !== ALERT_TYPE_TWITTER_LISTEN) return false;
  const p = parseTwitterListenAutoLaunchPayload(payload);
  if (!p) return false;
  const req = p.requestedExecution ?? p.execution;
  return req === 'auto_launch' || req === 'deploy';
}

export function tweetFromAutoLaunchPayload(payload: TwitterListenAutoLaunchPayload) {
  const tweet = tweetInputFromAlertPayload(payload);
  if (!tweet) return null;
  const subject = tweetLaunchCacheSubject(tweet);
  return { tweet, subject };
}
