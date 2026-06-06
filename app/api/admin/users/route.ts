import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/api/adminAuth';
import { searchUsers } from '@/lib/db/adminUsers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const QuerySchema = z.object({
  q: z.string().max(128).optional().default(''),
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
});

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req, 'users.read');
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    q: url.searchParams.get('q') ?? '',
    limit: url.searchParams.get('limit') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_query' }, { status: 400 });
  }

  try {
    const users = await searchUsers(parsed.data.q, parsed.data.limit);
    return NextResponse.json({ users });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'search_failed';
    return NextResponse.json({ error: 'search_failed', message }, { status: 500 });
  }
}
