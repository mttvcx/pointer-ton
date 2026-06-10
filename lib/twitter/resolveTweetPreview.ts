import 'server-only';

import { fetchFxTwitterTweet } from '@/lib/twitter/fxTwitterPreview';
import { extractTweetId } from '@/lib/twitter/tweetId';
import { fetchSyndicationTweet, parseSyndicationAffiliation } from '@/lib/twitter/syndicationTweet';
import {
  emptyTwitterTweetPreview,
  type TwitterTweetPreview,
  type TwitterTweetPreviewQuote,
} from '@/lib/twitter/tweetPreviewTypes';

function hiResAvatar(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  return url.replace(/_normal\.(jpg|png|webp)$/i, '.$1');
}

function parseSyndicationDate(raw: string | undefined): string | null {
  if (!raw?.trim()) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function syndicationMediaUrls(node: { mediaDetails?: { media_url_https?: string }[] } | null | undefined): string[] {
  if (!node?.mediaDetails?.length) return [];
  return node.mediaDetails
    .map((m) => m.media_url_https?.trim())
    .filter((u): u is string => Boolean(u));
}

type SyndicationTweetNodeUser = {
  name?: string;
  screen_name?: string;
  profile_image_url_https?: string;
  verified?: boolean;
  is_blue_verified?: boolean;
  highlighted_label?: {
    badge?: { url?: string };
    description?: string;
    url?: { url?: string };
  };
};

function syndicationAuthor(user: SyndicationTweetNodeUser | undefined): TwitterTweetPreview['author'] {
  if (!user) return null;
  const handle = user.screen_name?.trim() ?? null;
  return {
    name: user.name?.trim() ?? null,
    handle,
    avatar: hiResAvatar(user.profile_image_url_https),
    verified: user.is_blue_verified === true || user.verified === true,
    joinedAt: null,
    followerCount: null,
    profileUrl: handle ? `https://x.com/${encodeURIComponent(handle.replace(/^@/, ''))}` : null,
    affiliation: parseSyndicationAffiliation(user),
  };
}

function syndicationQuote(node: SyndicationTweetNode | undefined): TwitterTweetPreviewQuote | null {
  if (!node) return null;
  const mediaUrls = syndicationMediaUrls(node);
  return {
    text: node.text?.trim() ?? null,
    createdAt: parseSyndicationDate(node.created_at),
    author: syndicationAuthor(node.user),
    mediaUrls,
  };
}

type SyndicationTweetNode = {
  text?: string;
  created_at?: string;
  favorite_count?: number;
  conversation_count?: number;
  user?: SyndicationTweetNodeUser;
  mediaDetails?: { media_url_https?: string }[];
  in_reply_to_screen_name?: string;
};

/** Resolve Axiom-style tweet preview — syndication base + FX enrichment for engagement/views. */
export async function resolveTweetPreview(url: string): Promise<TwitterTweetPreview> {
  const tweetId = extractTweetId(url);
  if (!tweetId) return emptyTwitterTweetPreview(url);

  const [syndication, fx] = await Promise.all([
    fetchSyndicationTweet(tweetId),
    fetchFxTwitterTweet(tweetId),
  ]);

  if (!syndication && !fx) return emptyTwitterTweetPreview(url);

  const syndUser = syndication?.user;
  const handle = fx?.author?.handle ?? syndUser?.screen_name?.trim() ?? null;
  const author = {
    name: fx?.author?.name ?? syndUser?.name?.trim() ?? null,
    handle,
    avatar:
      hiResAvatar(fx?.author?.avatar) ??
      hiResAvatar(syndUser?.profile_image_url_https) ??
      null,
    verified:
      fx?.author?.verified === true ||
      syndUser?.is_blue_verified === true ||
      syndUser?.verified === true,
    joinedAt: fx?.author?.joinedAt ?? null,
    followerCount: fx?.author?.followerCount ?? null,
    profileUrl: handle
      ? `https://x.com/${encodeURIComponent(handle.replace(/^@/, ''))}`
      : null,
    affiliation: parseSyndicationAffiliation(syndUser),
  };

  const syndMedia = syndicationMediaUrls(syndication);
  const mediaUrls = fx?.mediaUrls?.length ? fx.mediaUrls : syndMedia;
  const quotedTweet =
    fx?.quotedTweet ??
    syndicationQuote(syndication?.quoted_tweet) ??
    null;

  return {
    type: 'tweet',
    url,
    fallback: false,
    text: fx?.text ?? syndication?.text?.trim() ?? null,
    createdAt: fx?.createdAt ?? parseSyndicationDate(syndication?.created_at),
    author,
    favorites:
      fx?.favorites ??
      (typeof syndication?.favorite_count === 'number' ? syndication.favorite_count : null),
    retweets: fx?.retweets ?? null,
    replies:
      fx?.replies ??
      (typeof syndication?.conversation_count === 'number'
        ? syndication.conversation_count
        : null),
    views: fx?.views ?? null,
    bookmarks: fx?.bookmarks ?? null,
    media: mediaUrls[0] ?? null,
    mediaUrls,
    replyingTo:
      fx?.replyingTo ??
      syndication?.in_reply_to_screen_name?.trim() ??
      null,
    quotedTweet,
  };
}
