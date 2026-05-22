import { NextResponse } from 'next/server';
import { getTwitterProfile } from '@/lib/twitter/profileProvider';

export const runtime = 'edge';

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ handle: string }> },
): Promise<Response> {
  const { handle: raw = '' } = await ctx.params;
  const handle = decodeURIComponent(raw).replace(/^@/, '').trim();
  if (!handle) {
    return NextResponse.json({ error: 'missing handle' }, { status: 400 });
  }

  try {
    const profile = await getTwitterProfile(handle);
    return NextResponse.json(profile, {
      headers: { 'cache-control': 'public, s-maxage=60, stale-while-revalidate=300' },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'lookup failed' },
      { status: 502 },
    );
  }
}
