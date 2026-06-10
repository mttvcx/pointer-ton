import { NextRequest, NextResponse } from 'next/server';
import { resolveTweetPreview } from '@/lib/twitter/resolveTweetPreview';
import {
  emptyTwitterTweetPreview,
  TwitterTweetPreviewSchema,
} from '@/lib/twitter/tweetPreviewTypes';
import { extractTwitterHandle } from '@/lib/utils/extractTwitterHandle';

function extractTwitterHandleFromUrl(url: string): string {
  if (!url.includes('://')) return extractTwitterHandle(url);
  try {
    const path = new URL(url).pathname.split('/').filter(Boolean);
    if (path[0] === 'i') return '';
    return path[0]?.replace(/^@/, '') ?? '';
  } catch {
    return extractTwitterHandle(url);
  }
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) return NextResponse.json({ error: 'No URL' }, { status: 400 });

  const isTweet = /\/status\/\d+/.test(url);

  if (isTweet) {
    try {
      const preview = await resolveTweetPreview(url);
      const parsed = TwitterTweetPreviewSchema.safeParse(preview);
      if (!parsed.success) {
        return NextResponse.json(emptyTwitterTweetPreview(url));
      }
      return NextResponse.json(parsed.data, {
        headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=86400' },
      });
    } catch {
      return NextResponse.json(emptyTwitterTweetPreview(url));
    }
  }

  const handle = extractTwitterHandleFromUrl(url);
  if (!handle) {
    return NextResponse.json({ error: 'No handle' }, { status: 400 });
  }
  return NextResponse.json({
    type: 'profile',
    handle,
    profileUrl: `https://x.com/${handle}`,
    fallback: false,
  });
}
