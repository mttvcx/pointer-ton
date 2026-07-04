import 'server-only';

/**
 * X (Twitter) API v2 client — recent-tweets fetch for the X Monitor ingest.
 *
 * ONE server-side poller feeds the DB, which fans out to every user — so the
 * API cost scales with (handles watched × poll frequency), NOT with user count.
 * `since_id` means we only ever pull NEW tweets, which is what keeps the monthly
 * read budget (Basic ≈ 15k reads/mo) alive.
 *
 * Dormant with no token: `xApiConfigured()` is false and every fetch returns []
 * so the whole pipeline no-ops until TWITTER_BEARER_TOKEN is set. Plug-and-play.
 */

const SEARCH_URL = 'https://api.twitter.com/2/tweets/search/recent';
/** Basic tier caps the search query at 512 chars; keep a safety margin. */
const MAX_QUERY_CHARS = 480;

export type XIngestTweet = {
  id: string;
  handle: string;
  text: string;
  imageUrls: string[];
  tweetUrl: string;
  createdAt: string | null;
  tweetKind: 'tweet' | 'reply' | 'quote' | 'retweet';
};

export function xApiConfigured(): boolean {
  return Boolean(process.env.TWITTER_BEARER_TOKEN?.trim());
}

/** Chunk handles so each OR-query stays under the tier's query-length cap. */
export function chunkHandlesForQuery(handles: string[]): string[][] {
  const chunks: string[][] = [];
  let cur: string[] = [];
  let len = 0;
  for (const h of handles) {
    const piece = `from:${h}`;
    const add = (cur.length ? 4 : 0) + piece.length; // " OR " between terms
    if (cur.length && len + add + 2 > MAX_QUERY_CHARS) {
      chunks.push(cur);
      cur = [];
      len = 0;
    }
    cur.push(h);
    len += cur.length === 1 ? piece.length : add;
  }
  if (cur.length) chunks.push(cur);
  return chunks;
}

function tweetKindFromRefs(refs: Array<{ type: string }> | undefined): XIngestTweet['tweetKind'] {
  if (!refs || refs.length === 0) return 'tweet';
  if (refs.some((r) => r.type === 'retweeted')) return 'retweet';
  if (refs.some((r) => r.type === 'quoted')) return 'quote';
  if (refs.some((r) => r.type === 'replied_to')) return 'reply';
  return 'tweet';
}

type RawMedia = { media_key: string; type?: string; url?: string; preview_image_url?: string };
type RawUser = { id: string; username: string };
type RawTweet = {
  id: string;
  text: string;
  author_id?: string;
  created_at?: string;
  referenced_tweets?: Array<{ type: string }>;
  attachments?: { media_keys?: string[] };
};

/**
 * Fetch recent tweets from a set of handles newer than `sinceId`.
 * Batches handles into OR-queries; one request per chunk. Best-effort — a failed
 * chunk (rate-limit, etc.) is skipped, not thrown.
 */
export async function fetchRecentTweetsFromHandles(
  handles: string[],
  sinceId?: string | null,
): Promise<XIngestTweet[]> {
  const token = process.env.TWITTER_BEARER_TOKEN?.trim();
  if (!token || handles.length === 0) return [];

  const out: XIngestTweet[] = [];
  for (const chunk of chunkHandlesForQuery(handles)) {
    const query = `(${chunk.map((h) => `from:${h}`).join(' OR ')})`;
    const params = new URLSearchParams({
      query,
      max_results: '100',
      expansions: 'attachments.media_keys,author_id',
      'media.fields': 'url,preview_image_url,type',
      'tweet.fields': 'created_at,referenced_tweets,attachments,author_id',
      'user.fields': 'username',
    });
    if (sinceId) params.set('since_id', sinceId);

    let json: {
      data?: RawTweet[];
      includes?: { media?: RawMedia[]; users?: RawUser[] };
    };
    try {
      const res = await fetch(`${SEARCH_URL}?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) {
        // 429 = rate limited, 4xx = query/plan issue — skip this chunk quietly.
        console.warn(`[x-monitor] search ${res.status} for chunk of ${chunk.length}`);
        continue;
      }
      json = await res.json();
    } catch (err) {
      console.warn('[x-monitor] search fetch failed:', err instanceof Error ? err.message : err);
      continue;
    }

    const usersById = new Map((json.includes?.users ?? []).map((u) => [u.id, u.username]));
    const mediaByKey = new Map((json.includes?.media ?? []).map((m) => [m.media_key, m]));

    for (const t of json.data ?? []) {
      const handle = t.author_id ? usersById.get(t.author_id) ?? '' : '';
      if (!handle) continue;
      const imageUrls = (t.attachments?.media_keys ?? [])
        .map((k) => mediaByKey.get(k))
        .map((m) => m?.url ?? m?.preview_image_url ?? null)
        .filter((u): u is string => Boolean(u));
      out.push({
        id: t.id,
        handle,
        text: t.text ?? '',
        imageUrls,
        tweetUrl: `https://x.com/${handle}/status/${t.id}`,
        createdAt: t.created_at ?? null,
        tweetKind: tweetKindFromRefs(t.referenced_tweets),
      });
    }
  }
  return out;
}
