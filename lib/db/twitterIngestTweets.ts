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
