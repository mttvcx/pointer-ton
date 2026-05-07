import { NextResponse, type NextRequest } from 'next/server';
import { listAlertsForTicker } from '@/lib/db/alerts';
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
    return NextResponse.json(
      { error: 'user_not_synced', message: 'Call /api/auth/sync first' },
      { status: 403 },
    );
  }

  const limitParam = req.nextUrl.searchParams.get('limit');
  const limit = Math.min(50, Math.max(1, limitParam ? Number(limitParam) || 20 : 20));

  const rows = await listAlertsForTicker(user.id, limit);
  return NextResponse.json({
    alerts: rows.map((r) => ({
      id: r.id,
      type: r.type,
      payload: r.payload,
      narration: r.ai_narration,
      createdAt: r.created_at,
    })),
  });
}
