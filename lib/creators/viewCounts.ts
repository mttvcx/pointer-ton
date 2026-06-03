import 'server-only';
import type { CreatorPlatform } from '@/lib/creators/config';
import { isCreatorDevLoginEnabled } from '@/lib/creators/devAuth';

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

export type ViewCountResult = {
  views: number | null;
  source: 'tiktok_html' | 'x_html' | 'instagram_html' | 'mock_dev' | 'unavailable';
};

function parseFirstInt(text: string, patterns: RegExp[]): number | null {
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) {
      const n = Number.parseInt(m[1], 10);
      if (Number.isFinite(n) && n >= 0) return n;
    }
  }
  return null;
}

function extractTweetId(url: string): string | null {
  const m = url.match(/(?:twitter\.com|x\.com)\/[^/]+\/status\/(\d+)/i);
  return m?.[1] ?? null;
}

function extractTikTokVideoId(url: string): string | null {
  const m = url.match(/\/video\/(\d+)/);
  return m?.[1] ?? null;
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': BROWSER_UA,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function fetchTikTokViews(url: string): Promise<ViewCountResult> {
  const canonical = extractTikTokVideoId(url)
    ? url
    : url.includes('vm.tiktok.com')
      ? url
      : url;

  const html = await fetchHtml(canonical);
  if (!html) return { views: null, source: 'unavailable' };

  const views =
    parseFirstInt(html, [
      /"playCount"\s*:\s*(\d+)/,
      /"viewCount"\s*:\s*(\d+)/,
      /"play_count"\s*:\s*(\d+)/,
    ]) ?? null;

  return { views, source: views != null ? 'tiktok_html' : 'unavailable' };
}

async function fetchXViews(url: string): Promise<ViewCountResult> {
  const tweetId = extractTweetId(url);
  const target = tweetId ? `https://x.com/i/status/${tweetId}` : url;
  const html = await fetchHtml(target);
  if (!html) return { views: null, source: 'unavailable' };

  const views =
    parseFirstInt(html, [
      /"views"\s*:\s*\{\s*"count"\s*:\s*"(\d+)"/,
      /"views"\s*:\s*\{\s*"count"\s*:\s*(\d+)/,
      /"view_count"\s*:\s*(\d+)/,
      /"viewCount"\s*:\s*(\d+)/,
    ]) ?? null;

  return { views, source: views != null ? 'x_html' : 'unavailable' };
}

async function fetchInstagramViews(url: string): Promise<ViewCountResult> {
  const html = await fetchHtml(url.endsWith('/') ? url : `${url}/`);
  if (!html) return { views: null, source: 'unavailable' };

  const views =
    parseFirstInt(html, [
      /"video_view_count"\s*:\s*(\d+)/,
      /"play_count"\s*:\s*(\d+)/,
      /"view_count"\s*:\s*(\d+)/,
    ]) ?? null;

  return { views, source: views != null ? 'instagram_html' : 'unavailable' };
}

/** Best-effort public view count scrape — may return null when platforms block bots. */
export async function fetchViewCountForUrl(
  url: string,
  platform: CreatorPlatform,
): Promise<ViewCountResult> {
  if (process.env.CREATOR_PORTAL_MOCK_VIEWS === '1') {
    return { views: 75_000, source: 'mock_dev' };
  }

  let result: ViewCountResult;
  switch (platform) {
    case 'tiktok':
      result = await fetchTikTokViews(url);
      break;
    case 'x':
      result = await fetchXViews(url);
      break;
    case 'instagram':
      result = await fetchInstagramViews(url);
      break;
    default:
      result = { views: null, source: 'unavailable' };
  }

  if (result.views == null && isCreatorDevLoginEnabled()) {
    return { views: 42_000, source: 'mock_dev' };
  }

  return result;
}
