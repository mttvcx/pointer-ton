import 'server-only';

import { parseFxTwitterMedia } from '@/lib/twitter/fxTwitterMedia';

type FxAuthor = {
  name?: string;
  screen_name?: string;
  avatar_url?: string;
  verified?: boolean;
  followers?: number;
  joined?: string;
};

type FxMediaItem = {
  type?: string;
  url?: string;
  thumbnail_url?: string;
};

type FxMedia = {
  photos?: FxMediaItem[];
  videos?: FxMediaItem[];
  all?: FxMediaItem[];
  mosaic?: { formats?: { jpeg?: string; webp?: string } };
};

type FxTweet = {
  text?: string;
  created_at?: string;
  likes?: number;
  retweets?: number;
  replies?: number;
  views?: number;
  bookmarks?: number;
  author?: FxAuthor;
  media?: FxMedia | FxMediaItem[];
  replying_to?: string | null;
  quote?: FxTweet;
};

type FxTweetResponse = {
  tweet?: FxTweet;
};

export type FxTwitterTweetPayload = {
  text: string | null;
  createdAt: string | null;
  favorites: number | null;
  retweets: number | null;
  replies: number | null;
  views: number | null;
  bookmarks: number | null;
  author: {
    name: string | null;
    handle: string | null;
    avatar: string | null;
    verified: boolean;
    joinedAt: string | null;
    followerCount: number | null;
    profileUrl: string | null;
    affiliation: null;
  } | null;
  mediaUrls: string[];
  replyingTo: string | null;
  quotedTweet: {
    text: string | null;
    createdAt: string | null;
    author: {
      name: string | null;
      handle: string | null;
      avatar: string | null;
      verified: boolean;
      joinedAt: string | null;
      followerCount: number | null;
      profileUrl: string | null;
      affiliation: null;
    } | null;
    mediaUrls: string[];
  } | null;
};

function parseFxDate(raw: string | undefined): string | null {
  if (!raw?.trim()) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function parseFxAuthor(a: FxAuthor | undefined): FxTwitterTweetPayload['author'] {
  if (!a) return null;
  const handle = a.screen_name?.trim() || null;
  return {
    name: a.name?.trim() || null,
    handle,
    avatar: a.avatar_url?.trim() || null,
    verified: a.verified === true,
    joinedAt: parseFxDate(a.joined),
    followerCount: typeof a.followers === 'number' ? a.followers : null,
    profileUrl: handle ? `https://x.com/${encodeURIComponent(handle.replace(/^@/, ''))}` : null,
    affiliation: null,
  };
}

function parseFxTweetNode(t: FxTweet | undefined): Omit<FxTwitterTweetPayload, never> | null {
  if (!t) return null;
  const mediaUrls = parseFxTwitterMedia(t.media);
  const quote = t.quote;
  return {
    text: t.text?.trim() || null,
    createdAt: parseFxDate(t.created_at),
    favorites: typeof t.likes === 'number' ? t.likes : null,
    retweets: typeof t.retweets === 'number' ? t.retweets : null,
    replies: typeof t.replies === 'number' ? t.replies : null,
    views: typeof t.views === 'number' ? t.views : null,
    bookmarks: typeof t.bookmarks === 'number' ? t.bookmarks : null,
    author: parseFxAuthor(t.author),
    mediaUrls,
    replyingTo: t.replying_to?.trim() || null,
    quotedTweet: quote
      ? {
          text: quote.text?.trim() || null,
          createdAt: parseFxDate(quote.created_at),
          author: parseFxAuthor(quote.author),
          mediaUrls: parseFxTwitterMedia(quote.media),
        }
      : null,
  };
}

export async function fetchFxTwitterTweet(tweetId: string): Promise<FxTwitterTweetPayload | null> {
  try {
    const res = await fetch(`https://api.fxtwitter.com/status/${encodeURIComponent(tweetId)}`, {
      headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 (compatible; Pointer/1.0)' },
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as FxTweetResponse;
    return parseFxTweetNode(json.tweet);
  } catch {
    return null;
  }
}
