import { tweetIdFromUrl } from '@/lib/launch/tweetLaunchSubject';
import type { TweetLaunchInput } from '@/lib/launch/types';

export type TwitterListenAlertPayload = {
  tweetId?: string;
  tweetText?: string;
  message?: string;
  handle?: string;
  tweetUrl?: string | null;
  imageUrls?: string[];
  coverImageUrl?: string | null;
  mint?: string | null;
  execution?: string;
  requestedExecution?: string;
  autoHeldReason?: string | null;
};

export function tweetInputFromAlertPayload(payload: unknown): TweetLaunchInput | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as TwitterListenAlertPayload;
  const text = p.tweetText?.trim() || p.message?.trim() || '';
  const handle = p.handle?.trim() ?? '';
  if (!text && !handle) return null;

  const imageUrls = [
    ...(Array.isArray(p.imageUrls) ? p.imageUrls : []),
    p.coverImageUrl,
  ]
    .filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
    .slice(0, 4);

  const id =
    p.tweetId?.trim() ||
    tweetIdFromUrl(p.tweetUrl) ||
    undefined;

  return {
    id,
    text: text || '(no text)',
    authorHandle: handle || 'unknown',
    imageUrls,
    tweetUrl: p.tweetUrl ?? null,
  };
}
