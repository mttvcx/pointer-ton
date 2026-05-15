import { NextRequest, NextResponse } from 'next/server';

function generateTweetToken(id: string): string {
  return ((Number(id) / 1e15) * Math.PI)
    .toString(6 ** 2)
    .replace(/(0+|\.)/g, '');
}

function extractTwitterHandle(value: string): string {
  if (!value) return '';
  let v = value.trim().replace(/^@/, '');
  if (v.includes('://')) {
    try {
      const u = new URL(v);
      v = u.pathname.split('/').filter(Boolean)[0] ?? '';
    } catch {
      v = v.split('/').filter(Boolean).pop() ?? '';
    }
  }
  return v.split('?')[0] ?? '';
}

function extractTweetId(url: string): string | null {
  const match = url.match(/\/status\/(\d+)/);
  return match?.[1] ?? null;
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) return NextResponse.json({ error: 'No URL' }, { status: 400 });

  const tweetId = extractTweetId(url);

  if (tweetId) {
    // TWEET — use syndication API with token (works reliably, no auth)
    try {
      const token = generateTweetToken(tweetId);
      const res = await fetch(
        `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&token=${token}`,
        {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          next: { revalidate: 300 },
        },
      );

      if (!res.ok) {
        return NextResponse.json({ type: 'tweet', fallback: true, url });
      }

      const data = await res.json();
      return NextResponse.json(
        {
          type: 'tweet',
          text: data.text ?? null,
          createdAt: data.created_at ?? null,
          author: {
            name: data.user?.name ?? null,
            handle: data.user?.screen_name ?? null,
            avatar: data.user?.profile_image_url_https ?? null,
            verified: data.user?.verified ?? data.user?.is_blue_verified ?? false,
          },
          favorites: data.favorite_count ?? null,
          media: data.mediaDetails?.[0]?.media_url_https ?? null,
          url,
          fallback: false,
        },
        {
          headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=86400' },
        },
      );
    } catch {
      return NextResponse.json({ type: 'tweet', fallback: true, url });
    }
  } else {
    // PROFILE — no reliable free unauthenticated endpoint exists.
    // Return minimal honest data: just the handle.
    // For richer cards, the user would need to add a paid service (SocialData.tools etc).
    const handle = extractTwitterHandle(url);
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
}
