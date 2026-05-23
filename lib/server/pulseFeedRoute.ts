import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getPulseFeed } from '@/lib/helius/feed';
import type { AppChainId } from '@/lib/chains/appChain';
import { DEFAULT_APP_CHAIN, isAppChainId } from '@/lib/chains/appChain';
import { withTimeout } from '@/lib/utils/withTimeout';

const FEED_TIMEOUT_MS = 12_000;

const QuerySchema = z.object({
  column: z.enum(['new', 'stretch', 'migrated']).default('new'),
  chain: z.string().optional(),
});

/** Shared handler for Pulse feed JSON — mounted at `/api/pulse/feed` and `/api/tokens/feed`. */
export async function pulseFeedRouteGET(req: NextRequest) {
  const parsed = QuerySchema.safeParse({
    column: req.nextUrl.searchParams.get('column') ?? undefined,
    chain: req.nextUrl.searchParams.get('chain') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_query', issues: parsed.error.issues }, { status: 400 });
  }
  const { column } = parsed.data;
  const chainRaw = parsed.data.chain;
  const chain: AppChainId = chainRaw && isAppChainId(chainRaw) ? chainRaw : DEFAULT_APP_CHAIN;
  try {
    const items = await withTimeout(
      getPulseFeed(column, chain),
      FEED_TIMEOUT_MS,
      'pulse_feed',
    );
    return NextResponse.json({ column, chain, items });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'feed failed';
    const timedOut = message.includes('_timeout_');
    if (timedOut) {
      console.warn('[pointer][pulse] feed GET timed out', { column, chain, message });
      return NextResponse.json({
        column,
        chain,
        items: [],
        warning: 'feed_timeout',
      });
    }
    return NextResponse.json({ error: 'feed_failed', message, items: [] }, { status: 500 });
  }
}
