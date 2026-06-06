import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/api/adminAuth';
import { logAdminAction } from '@/lib/db/admin';
import { listFlags, upsertFlag, getFlagRow } from '@/lib/flags/store';
import type { Json } from '@/lib/supabase/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z
  .object({
    key: z.string().trim().min(2).max(120),
    value: z.union([z.boolean(), z.string(), z.number()]),
    description: z.string().trim().max(300).optional(),
    allowProd: z.boolean().optional(),
    reason: z.string().trim().max(500).optional(),
  })
  .strict();

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req, 'flags.read');
  if (!auth.ok) return auth.response;
  try {
    const flags = await listFlags();
    return NextResponse.json({ flags });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'list_failed';
    return NextResponse.json({ error: 'list_failed', message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req, 'flags.write');
  if (!auth.ok) return auth.response;

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (err) {
    const message = err instanceof Error ? err.message : 'invalid_body';
    return NextResponse.json({ error: 'invalid_body', message }, { status: 400 });
  }

  // Prod-write guard: dev-only flags (allow_prod=false) cannot be toggled in
  // production. The existing row's allow_prod wins unless this request sets it.
  const existing = await getFlagRow(body.key);
  const effectiveAllowProd = body.allowProd ?? existing?.allow_prod ?? false;
  if (process.env.NODE_ENV === 'production' && !effectiveAllowProd) {
    return NextResponse.json(
      { error: 'prod_write_blocked', message: 'Flag is not marked allow_prod.' },
      { status: 403 },
    );
  }

  try {
    const flag = await upsertFlag({
      key: body.key,
      value: body.value as Json,
      description: body.description,
      allowProd: body.allowProd,
      updatedByUserId: auth.ctx.userId === 'system' ? null : auth.ctx.userId,
    });
    await logAdminAction({
      ctx: auth.ctx,
      action: 'flags.set',
      targetType: 'feature_flag',
      targetId: body.key,
      reason: body.reason ?? null,
      before: (existing?.value ?? null) as Json,
      after: body.value as Json,
      metadata: { allowProd: effectiveAllowProd },
      ip: auth.ip,
    });
    return NextResponse.json({ flag });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'set_failed';
    return NextResponse.json({ error: 'set_failed', message }, { status: 500 });
  }
}
