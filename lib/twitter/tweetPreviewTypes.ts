import { z } from 'zod';

export const TwitterAffiliationSchema = z.object({
  name: z.string(),
  badgeUrl: z.string().nullable(),
  url: z.string().nullable(),
});

export const TwitterTweetPreviewAuthorSchema = z.object({
  name: z.string().nullable(),
  handle: z.string().nullable(),
  avatar: z.string().nullable(),
  verified: z.boolean(),
  joinedAt: z.string().nullable(),
  followerCount: z.number().nullable(),
  profileUrl: z.string().nullable(),
  affiliation: TwitterAffiliationSchema.nullable(),
});

export const TwitterTweetPreviewQuoteSchema = z.object({
  text: z.string().nullable(),
  createdAt: z.string().nullable(),
  author: TwitterTweetPreviewAuthorSchema.nullable(),
  mediaUrls: z.array(z.string()),
});

export const TwitterTweetPreviewSchema = z.object({
  type: z.literal('tweet'),
  url: z.string().url(),
  fallback: z.boolean(),
  text: z.string().nullable(),
  createdAt: z.string().nullable(),
  author: TwitterTweetPreviewAuthorSchema.nullable(),
  favorites: z.number().nullable(),
  retweets: z.number().nullable(),
  replies: z.number().nullable(),
  views: z.number().nullable(),
  bookmarks: z.number().nullable(),
  /** First media URL — kept for backward compatibility. */
  media: z.string().nullable(),
  mediaUrls: z.array(z.string()),
  replyingTo: z.string().nullable(),
  quotedTweet: TwitterTweetPreviewQuoteSchema.nullable(),
});

export type TwitterTweetPreviewAuthor = z.infer<typeof TwitterTweetPreviewAuthorSchema>;
export type TwitterTweetPreviewQuote = z.infer<typeof TwitterTweetPreviewQuoteSchema>;
export type TwitterTweetPreview = z.infer<typeof TwitterTweetPreviewSchema>;

export function emptyTwitterTweetPreview(url: string): TwitterTweetPreview {
  return {
    type: 'tweet',
    url,
    fallback: true,
    text: null,
    createdAt: null,
    author: null,
    favorites: null,
    retweets: null,
    replies: null,
    views: null,
    bookmarks: null,
    media: null,
    mediaUrls: [],
    replyingTo: null,
    quotedTweet: null,
  };
}

function coerceMediaUrls(media: unknown, mediaUrls: unknown): string[] {
  if (Array.isArray(mediaUrls)) {
    return mediaUrls.filter((u): u is string => typeof u === 'string' && u.trim().length > 0);
  }
  if (typeof media === 'string' && media.trim()) return [media.trim()];
  return [];
}

function coerceAffiliation(raw: unknown): TwitterTweetPreviewAuthor['affiliation'] {
  if (!raw || typeof raw !== 'object') return null;
  const a = raw as Record<string, unknown>;
  const name = typeof a.name === 'string' ? a.name.trim() : '';
  if (!name) return null;
  return {
    name,
    badgeUrl: typeof a.badgeUrl === 'string' ? a.badgeUrl : null,
    url: typeof a.url === 'string' ? a.url : null,
  };
}

function coerceAuthor(raw: unknown): TwitterTweetPreviewAuthor | null {
  if (!raw || typeof raw !== 'object') return null;
  const a = raw as Record<string, unknown>;
  const handle = typeof a.handle === 'string' ? a.handle : null;
  return {
    name: typeof a.name === 'string' ? a.name : null,
    handle,
    avatar: typeof a.avatar === 'string' ? a.avatar : null,
    verified: a.verified === true,
    joinedAt: typeof a.joinedAt === 'string' ? a.joinedAt : null,
    followerCount: typeof a.followerCount === 'number' ? a.followerCount : null,
    profileUrl:
      typeof a.profileUrl === 'string'
        ? a.profileUrl
        : handle
          ? `https://x.com/${encodeURIComponent(handle.replace(/^@/, ''))}`
          : null,
    affiliation: coerceAffiliation(a.affiliation),
  };
}

function coerceQuote(raw: unknown): TwitterTweetPreviewQuote | null {
  if (!raw || typeof raw !== 'object') return null;
  const q = raw as Record<string, unknown>;
  return {
    text: typeof q.text === 'string' ? q.text : null,
    createdAt: typeof q.createdAt === 'string' ? q.createdAt : null,
    author: coerceAuthor(q.author),
    mediaUrls: coerceMediaUrls(q.media, q.mediaUrls),
  };
}

/** Coerce API / TanStack cache payloads — old responses may omit `mediaUrls`. */
export function normalizeTwitterTweetPreview(raw: unknown): TwitterTweetPreview {
  const parsed = TwitterTweetPreviewSchema.safeParse(raw);
  if (parsed.success) return parsed.data;

  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const url = typeof r.url === 'string' && r.url.trim() ? r.url.trim() : 'https://x.com';
  const mediaUrls = coerceMediaUrls(r.media, r.mediaUrls);
  const media = typeof r.media === 'string' ? r.media : mediaUrls[0] ?? null;

  return {
    type: 'tweet',
    url,
    fallback: r.fallback !== false,
    text: typeof r.text === 'string' ? r.text : null,
    createdAt: typeof r.createdAt === 'string' ? r.createdAt : null,
    author: coerceAuthor(r.author),
    favorites: typeof r.favorites === 'number' ? r.favorites : null,
    retweets: typeof r.retweets === 'number' ? r.retweets : null,
    replies: typeof r.replies === 'number' ? r.replies : null,
    views: typeof r.views === 'number' ? r.views : null,
    bookmarks: typeof r.bookmarks === 'number' ? r.bookmarks : null,
    media,
    mediaUrls,
    replyingTo: typeof r.replyingTo === 'string' ? r.replyingTo : null,
    quotedTweet: coerceQuote(r.quotedTweet),
  };
}

export function tweetPreviewMediaUrls(data: {
  media?: string | null;
  mediaUrls?: string[] | null;
}): string[] {
  if (Array.isArray(data.mediaUrls) && data.mediaUrls.length > 0) return data.mediaUrls;
  if (data.media?.trim()) return [data.media.trim()];
  return [];
}
