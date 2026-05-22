-- Tweet ingest cache with perceptual image hashes for image_match rules.
-- Run in Supabase SQL editor, then NOTIFY pgrst, 'reload schema';

create table if not exists public.twitter_ingest_tweets (
  tweet_id text primary key,
  author_handle text not null,
  text text not null default '',
  image_urls text[] not null default '{}'::text[],
  image_hashes jsonb not null default '[]'::jsonb,
  tweet_kind text,
  tweet_url text,
  raw_json jsonb,
  received_at timestamptz not null default now()
);

create index if not exists twitter_ingest_tweets_handle_idx
  on public.twitter_ingest_tweets (author_handle, received_at desc);

NOTIFY pgrst, 'reload schema';
