import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAdmin, requireAnyAdmin } from '@/lib/api/adminAuth';
import { logAdminAction } from '@/lib/db/admin';
import { getProviderStates, setProviderCutoff } from '@/lib/providers/circuitBreaker';
import { PROVIDER_NAMES } from '@/lib/providers/breakerDecisions';
import type { Json } from '@/lib/supabase/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z
  .object({
    provider: z.enum(PROVIDER_NAMES as unknown as [string, ...string[]]),
    disabled: z.boolean(),
    reason: z.string().trim().max(500).optional(),
  })
  .strict();

/** Provider circuit-breaker dashboard — per-provider usage vs daily/monthly
 *  budget, computed state, and manual-cutoff flag. Any admin may view. */
export async function GET(req: NextRequest) {
  const auth = await requireAnyAdmin(req);
  if (!auth.ok) return auth.response;
  try {
    return NextResponse.json({ providers: await getProviderStates() });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'read_failed';
    return NextResponse.json({ error: 'read_failed', message }, { status: 500 });
  }
}

/** Toggle a provider's manual emergency cutoff. Audit-logged and reversible
 *  (send the inverse). Persists to Redis → live on the next provider call. */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req, 'providers.control');
  if (!auth.ok) return auth.response;

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (err) {
    const message = err instanceof Error ? err.message : 'invalid_body';
    return NextResponse.json({ error: 'invalid_body', message }, { status: 400 });
  }

  const provider = body.provider as (typeof PROVIDER_NAMES)[number];
  try {
    await setProviderCutoff(provider, body.disabled);
    await logAdminAction({
      ctx: auth.ctx,
      action: body.disabled ? 'providers.cutoff' : 'providers.restore',
      targetType: 'provider_breaker',
      targetId: provider,
      reason: body.reason ?? null,
      before: null,
      after: { provider, disabled: body.disabled } as unknown as Json,
      metadata: { disabled: body.disabled },
      ip: auth.ip,
    });
    return NextResponse.json({ ok: true, provider, disabled: body.disabled });
  } catch (err) {
    // Redis unreachable → the cutoff did NOT take effect. Tell the admin clearly.
    const message = err instanceof Error ? err.message : 'set_failed';
    return NextResponse.json(
      { error: 'set_failed', message: 'Breaker store unreachable — change NOT applied.', detail: message },
      { status: 503 },
    );
  }
}
