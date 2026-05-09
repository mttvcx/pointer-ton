import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { listExploreTopBundlesForChain } from '@/lib/db/tokens';
import type { AppChainId } from '@/lib/chains/appChain';
import { DEFAULT_APP_CHAIN, isAppChainId } from '@/lib/chains/appChain';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const QuerySchema = z.object({
  chain: z.string().optional(),
  limit: z.coerce.number().int().min(5).max(100).optional(),
});

export async function GET(req: NextRequest) {
  const parsed = QuerySchema.safeParse({
    chain: req.nextUrl.searchParams.get('chain') ?? undefined,
    limit: req.nextUrl.searchParams.get('limit') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_query', issues: parsed.error.issues }, { status: 400 });
  }

  const chainRaw = parsed.data.chain;
  const chain: AppChainId =
    chainRaw && isAppChainId(chainRaw) ? chainRaw : DEFAULT_APP_CHAIN;
  const limit = parsed.data.limit ?? 40;

  try {
    const items = await listExploreTopBundlesForChain(chain, limit);
    return NextResponse.json({ chain, limit, items });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'explore_failed';
    return NextResponse.json({ error: 'explore_failed', message }, { status: 500 });
  }
}
