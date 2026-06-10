import 'server-only';

import { extractTweetId, syndicationTweetToken } from '@/lib/twitter/tweetId';

export { extractTweetId, syndicationTweetToken } from '@/lib/twitter/tweetId';

type SyndicationHighlightedLabel = {
  badge?: { url?: string };
  description?: string;
  url?: { url?: string };
};

type SyndicationUser = {
  name?: string;
  screen_name?: string;
  profile_image_url_https?: string;
  verified?: boolean;
  is_blue_verified?: boolean;
  highlighted_label?: SyndicationHighlightedLabel;
};

export type TwitterSyndicationAffiliation = {
  name: string;
  badgeUrl: string | null;
  url: string | null;
};

export function parseSyndicationAffiliation(
  user: SyndicationUser | undefined,
): TwitterSyndicationAffiliation | null {
  const label = user?.highlighted_label;
  if (!label) return null;
  const name = label.description?.trim();
  if (!name) return null;
  return {
    name,
    badgeUrl: label.badge?.url?.trim() ?? null,
    url: label.url?.url?.trim() ?? null,
  };
}

type SyndicationTweetNode = {
  text?: string;
  created_at?: string;
  favorite_count?: number;
  conversation_count?: number;
  user?: SyndicationUser;
  mediaDetails?: { media_url_https?: string }[];
  in_reply_to_screen_name?: string;
};

type SyndicationTweet = SyndicationTweetNode & {
  quoted_tweet?: SyndicationTweetNode;
};

/** Official X embed syndication — no API key. */
export async function fetchSyndicationTweet(tweetId: string): Promise<SyndicationTweet | null> {
  try {
    const token = syndicationTweetToken(tweetId);
    const res = await fetch(
      `https://cdn.syndication.twimg.com/tweet-result?id=${encodeURIComponent(tweetId)}&token=${encodeURIComponent(token)}&lang=en`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Pointer/1.0)' },
        next: { revalidate: 300 },
      },
    );
    if (!res.ok) return null;
    return (await res.json()) as SyndicationTweet;
  } catch {
    return null;
  }
}
