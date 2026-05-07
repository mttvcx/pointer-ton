import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { fetchLeaderboardPage } from '@/lib/points/leaderboard';
import { getUserByPrivyId } from '@/lib/db/users';
import { verifyPrivyAccessToken } from '@/lib/privy/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const QuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(25),
  q: z.string().max(64).optional(),
});

async function requireUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const accessToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length).trim()
    : null;
  if (!accessToken) return { error: NextResponse.json({ error: 'missing_authorization' }, { status: 401 }) };
  let verified;
  try {
    verified = await verifyPrivyAccessToken(accessToken);
  } catch {
    return { error: NextResponse.json({ error: 'invalid_token' }, { status: 401 }) };
  }
  const user = await getUserByPrivyId(verified.privyId);
  if (!user) {
    return {
      error: NextResponse.json(
        { error: 'user_not_synced', message: 'Call /api/auth/sync first' },
        { status: 403 },
      ),
    };
  }
  return { user };
}

export async function GET(req: NextRequest) {
  const r = await requireUser(req);
  if ('error' in r) return r.error;

  const url = new URL(req.url);
  let query: z.infer<typeof QuerySchema>;
  try {
    query = QuerySchema.parse(Object.fromEntries(url.searchParams.entries()));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'invalid_query';
    return NextResponse.json({ error: 'invalid_query', message }, { status: 400 });
  }

  try {
    const payload = await fetchLeaderboardPage({
      page: query.page,
      pageSize: query.pageSize,
      query: query.q,
      viewerUserId: r.user.id,
    });
    return NextResponse.json(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
