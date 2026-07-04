import 'server-only';

import { createAdminSupabase } from '@/lib/supabase/server';
import type { Json } from '@/lib/supabase/types';
import type { TweetImageHashEntry } from '@/lib/image/perceptualHash.server';

export type TwitterIngestTweetRow = {
  tweet_id: string;
  author_handle: string;
  text: string;
  image_urls: string[];
  image_hashes: TweetImageHashEntry[];
  tweet_kind: string | null;
  tweet_url: string | null;
  raw_json: Json | null;
  received_at: string;
};

/**
 * Highest tweet_id we've already ingested — used as the X search `since_id` so
 * each poll only pulls NEW tweets (snowflake IDs are monotonic; text-desc order
 * is numeric for equal-length 19-digit ids). Null when the table is empty.
 */
export async function getLatestIngestedTweetId(): Promise<string | null> {
  const supabase = createAdminSupabase();
  const { data } = await supabase
    .from('twitter_ingest_tweets')
    .select('tweet_id')
    .order('tweet_id', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.tweet_id ?? null;
}

/** Recent ingested tweets for the raw X Monitor feed (newest first). */
export async function listRecentIngestTweets(limit = 40): Promise<TwitterIngestTweetRow[]> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('twitter_ingest_tweets')
    .select('tweet_id, author_handle, text, image_urls, image_hashes, tweet_kind, tweet_url, raw_json, received_at')
    .order('received_at', { ascending: false })
    .limit(Math.min(80, Math.max(1, limit)));
  if (error) throw new Error(`listRecentIngestTweets failed: ${error.message}`);
  return (data ?? []) as TwitterIngestTweetRow[];
}

export async function upsertTwitterIngestTweet(row: {
  tweetId: string;
  authorHandle: string;
  text: string;
  imageUrls: string[];
  imageHashes: TweetImageHashEntry[];
  tweetKind?: string | null;
  tweetUrl?: string | null;
  rawJson?: Json | null;
}): Promise<void> {
  const supabase = createAdminSupabase();
  const { error } = await supabase.from('twitter_ingest_tweets').upsert(
    {
      tweet_id: row.tweetId,
      author_handle: row.authorHandle,
      text: row.text,
      image_urls: row.imageUrls,
      image_hashes: row.imageHashes as unknown as Json,
      tweet_kind: row.tweetKind ?? null,
      tweet_url: row.tweetUrl ?? null,
      raw_json: row.rawJson ?? null,
      received_at: new Date().toISOString(),
    },
    { onConflict: 'tweet_id' },
  );
  if (error) throw new Error(`upsertTwitterIngestTweet failed: ${error.message}`);
}
