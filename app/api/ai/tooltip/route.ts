import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireSyncedUser } from '@/lib/ai/auth';
import { aiErrorResponse, badBodyResponse } from '@/lib/ai/http';
import { tooltip } from '@/lib/ai/pipelines/tooltip';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z
  .object({
    term: z.string().trim().min(1).max(80),
    context: z.string().trim().max(200).optional(),
  })
  .strict();

export async function POST(req: NextRequest) {
  const auth = await requireSyncedUser(req);
  if (!auth.ok) return auth.response;

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (err) {
    return badBodyResponse(err);
  }

  try {
    const out = await tooltip({
      term: body.term,
      context: body.context,
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
