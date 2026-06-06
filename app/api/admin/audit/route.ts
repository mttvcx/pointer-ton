import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/api/adminAuth';
import { listAuditLog } from '@/lib/db/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Query = z.object({
  action: z.string().max(80).optional(),
  targetType: z.string().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional().default(100),
});

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req, 'audit.read');
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const parsed = Query.safeParse({
    action: url.searchParams.get('action') ?? undefined,
    targetType: url.searchParams.get('targetType') ?? undefined,
    limit: url.searchParams.get('limit') ?? undefined,
  });
  if (!parsed.success) return NextResponse.json({ error: 'invalid_query' }, { status: 400 });

  try {
    const entries = await listAuditLog({
      action: parsed.data.action,
      targetType: parsed.data.targetType,
      limit: parsed.data.limit,
    });
    return NextResponse.json({ entries });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'list_failed';
    return NextResponse.json({ error: 'list_failed', message }, { status: 500 });
  }
}
