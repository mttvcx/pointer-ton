import { NextRequest, NextResponse } from 'next/server';

/**
 * Twitter / X preview metadata fetcher.
 *
 * Uses the public `publish.twitter.com/oembed` endpoint which is unauthenticated
 * for public tweets. Profile URLs don't have a useful oEmbed payload, so we
 * extract the handle from the URL and return a lightweight profile descriptor
 * for the caller to render. Never calls the Twitter API directly — auth-free.
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) return NextResponse.json({ error: 'No URL' }, { status: 400 });

  try {
    const isProfile = !url.includes('/status/');

    if (!isProfile) {
      // Tweet preview via oEmbed
      const oembed = await fetch(
        `https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}&omit_script=true`,
      );
      if (!oembed.ok) {
        return NextResponse.json({ error: 'Failed' }, { status: 502 });
      }
      const data = (await oembed.json()) as {
        html?: string;
        author_name?: string;
        author_url?: string;
      };
      return NextResponse.json({
        type: 'tweet',
        html: data.html ?? '',
        author: data.author_name ?? '',
        authorUrl: data.author_url ?? '',
      });
    }

    // Profile — extract handle from URL
    const cleanUrl = url.split('?')[0]?.split('#')[0] ?? url;
    const handle =
      cleanUrl
        .split('/')
        .filter(Boolean)
        .pop() ?? '';
    return NextResponse.json({
      type: 'profile',
      handle,
      profileUrl: url,
    });
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
