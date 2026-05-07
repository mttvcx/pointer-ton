import { NextResponse, type NextRequest } from 'next/server';
import { getPendingAnnouncementForUser } from '@/lib/db/announcements';
import { getUserByPrivyId } from '@/lib/db/users';
import { verifyPrivyAccessToken } from '@/lib/privy/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const accessToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length).trim()
    : null;
  if (!accessToken) {
    return NextResponse.json({ error: 'missing_authorization' }, { status: 401 });
  }
  let verified;
  try {
    verified = await verifyPrivyAccessToken(accessToken);
  } catch {
    return NextResponse.json({ error: 'invalid_token' }, { status: 401 });
  }
  const user = await getUserByPrivyId(verified.privyId);
  if (!user) {
    return NextResponse.json({ error: 'user_not_synced' }, { status: 403 });
  }

  try {
    const row = await getPendingAnnouncementForUser(user.id);
    if (!row) {
      return NextResponse.json({ announcement: null });
    }
    return NextResponse.json({
      announcement: {
        id: row.id,
        slug: row.slug,
        headline: row.headline,
        description: row.description,
        videoUrl: row.video_url,
        showFrom: row.show_from,
        showUntil: row.show_until,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
