import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireSyncedUser } from '@/lib/ai/auth';
import { aiErrorResponse, badBodyResponse } from '@/lib/ai/http';
import { explainToken } from '@/lib/ai/pipelines/explainToken';
import { APP_CHAIN_IDS, isAppChainId } from '@/lib/chains/appChain';
import { isValidTokenMintParam } from '@/lib/chains/mintKind';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z
  .object({
    mint: z.string().refine((m) => isValidTokenMintParam(m), 'invalid mint'),
    mode: z.enum(['fast', 'deep']).default('fast'),
    surface: z.enum(['hover', 'copilot']).optional(),
    chain: z.enum(APP_CHAIN_IDS as unknown as [typeof APP_CHAIN_IDS[number], ...typeof APP_CHAIN_IDS[number][]]).optional(),
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
    const out = await explainToken({
      mint: body.mint,
      mode: body.mode,
      surface: body.surface,
      chain: body.chain && isAppChainId(body.chain) ? body.chain : undefined,
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
