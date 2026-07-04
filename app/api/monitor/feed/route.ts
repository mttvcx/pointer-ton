import { NextResponse, type NextRequest } from 'next/server';
import { listRecentIngestTweets } from '@/lib/db/twitterIngestTweets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/monitor/feed — the raw X Monitor tweet stream (default KOLs + rule
 * handles), newest first. Empty until the ingest cron runs (needs
 * TWITTER_BEARER_TOKEN). Public read of already-ingested public tweets.
 */
export async function GET(req: NextRequest) {
  const limit = Number(req.nextUrl.searchParams.get('limit')) || 40;
  try {
    const rows = await listRecentIngestTweets(limit);
    const tweets = rows.map((r) => ({
      id: r.tweet_id,
      handle: r.author_handle,
      text: r.text,
      imageUrls: r.image_urls ?? [],
      tweetUrl: r.tweet_url,
      tweetKind: r.tweet_kind,
      receivedAt: r.received_at,
    }));
    return NextResponse.json({ tweets });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'feed_failed';
    return NextResponse.json({ error: 'feed_failed', message, tweets: [] }, { status: 500 });
  }
}
