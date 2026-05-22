import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireSyncedUser } from '@/lib/ai/auth';
import { aiErrorResponse } from '@/lib/ai/http';
import { explainToken } from '@/lib/ai/pipelines/explainToken';
import { isValidTokenMintParam } from '@/lib/chains/mintKind';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z
  .object({
    mint: z.string().refine((m) => isValidTokenMintParam(m), 'invalid mint'),
    mode: z.enum(['fast', 'deep']).default('fast'),
    surface: z.enum(['hover', 'copilot']).optional(),
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
    const out = await explainToken({
      mint: body.mint,
      mode: body.mode,
      surface: body.surface,
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
