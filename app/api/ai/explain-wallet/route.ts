import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireSyncedUser } from '@/lib/ai/auth';
import { aiErrorResponse } from '@/lib/ai/http';
import { explainWallet } from '@/lib/ai/pipelines/explainWallet';
import { isValidPublicKey } from '@/lib/utils/addresses';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z
  .object({
    address: z.string().refine(isValidPublicKey, 'invalid address'),
    mode: z.enum(['fast', 'deep']).default('fast'),
  })
  .strict();

export async function POST(req: NextRequest) {
  const auth = await requireSyncedUser(req);
  if (!auth.ok) return auth.response;

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (err) {
    const message = err instanceof Error ? err.message : 'invalid_body';
    return NextResponse.json({ error: 'invalid_body', message }, { status: 400 });
  }

  try {
    const out = await explainWallet({
      address: body.address,
      mode: body.mode,
      userId: auth.user.id,
    });
    return NextResponse.json({
      data: out.data,
      cacheHit: out.cacheHit,
      fromCache: out.fromCache,
      modelUsed: out.modelUsed,
      costUsd: out.costUsd,
    });
  } catch (err) {
    return aiErrorResponse(err);
  }
}
