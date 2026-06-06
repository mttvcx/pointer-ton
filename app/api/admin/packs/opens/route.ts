import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/api/adminAuth';
import { listPackOpens } from '@/lib/db/packs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Query = z.object({
  userId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(100),
});

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req, 'packs.read');
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const parsed = Query.safeParse({
    userId: url.searchParams.get('userId') ?? undefined,
    limit: url.searchParams.get('limit') ?? undefined,
  });
  if (!parsed.success) return NextResponse.json({ error: 'invalid_query' }, { status: 400 });

  try {
    const opens = await listPackOpens(parsed.data);
    return NextResponse.json({ opens });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'list_failed';
    return NextResponse.json({ error: 'list_failed', message }, { status: 500 });
  }
}
