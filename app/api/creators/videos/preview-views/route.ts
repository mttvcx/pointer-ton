import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireCreator } from '@/lib/api/creatorAuth';
import { detectPlatformFromUrl } from '@/lib/creators/config';
import { fetchViewCountForUrl } from '@/lib/creators/viewCounts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const QuerySchema = z.object({
  url: z.string().url().max(512),
});

export async function GET(req: NextRequest) {
  const auth = await requireCreator(req);
  if ('error' in auth) return auth.error;

  const parsed = QuerySchema.safeParse({
    url: req.nextUrl.searchParams.get('url'),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_url' }, { status: 400 });
  }

  const platform = detectPlatformFromUrl(parsed.data.url);
  if (!platform) {
    return NextResponse.json({ error: 'unsupported_platform' }, { status: 400 });
  }

  const result = await fetchViewCountForUrl(parsed.data.url, platform);
  return NextResponse.json({ platform, ...result });
}
