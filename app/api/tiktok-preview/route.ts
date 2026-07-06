import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * TikTok preview via the public oEmbed endpoint (keyless) — mirrors the Twitter
 * preview route. Returns author + thumbnail for a TikTok profile/video URL so the
 * hover card can show a real preview. Fails soft (fallback) so the card still renders.
 */
export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get('url');
  const url = raw?.trim();
  if (!url || !/tiktok\.com/i.test(url)) {
    return NextResponse.json({ error: 'invalid tiktok url' }, { status: 400 });
  }
  const handleFromUrl = url.match(/@([\w.]+)/)?.[1] ?? null;
  try {
    const r = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return NextResponse.json({ type: 'tiktok', url, fallback: true, handle: handleFromUrl, authorName: null, authorUrl: null, title: null, thumbnailUrl: null }, { status: 200 });
    const j = (await r.json()) as {
      author_name?: string;
      author_url?: string;
      author_unique_id?: string;
      title?: string;
      thumbnail_url?: string;
    };
    const handle = j.author_unique_id ?? j.author_url?.match(/@([\w.]+)/)?.[1] ?? handleFromUrl;
    return NextResponse.json(
      {
        type: 'tiktok',
        url,
        fallback: false,
        authorName: j.author_name ?? null,
        authorUrl: j.author_url ?? null,
        handle,
        title: j.title ?? null,
        thumbnailUrl: j.thumbnail_url ?? null,
      },
      { status: 200 },
    );
  } catch {
    return NextResponse.json({ type: 'tiktok', url, fallback: true, handle: handleFromUrl, authorName: null, authorUrl: null, title: null, thumbnailUrl: null }, { status: 200 });
  }
}
