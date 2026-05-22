import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireSyncedUser } from '@/lib/ai/auth';
import { authorizeAdminRequest } from '@/lib/admin/authorize';
import { deleteScanCache } from '@/lib/ai/scanCache';
import {
  getAiScanCacheStatsToday,
  listTopAiScanCacheByHitsToday,
} from '@/lib/db/aiScanCache';
import {
  AI_SCAN_AVG_SAVED_OUTPUT_TOKENS,
  MODEL_PRICING_USD_PER_MTOK,
} from '@/lib/utils/constants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FlushBody = z.object({ cacheKey: z.string().min(8).max(256) }).strict();

export async function GET(req: NextRequest) {
  const auth = await requireSyncedUser(req);
  if (!auth.ok) return auth.response;
  if (!authorizeAdminRequest(req, auth.user.wallet_address)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const [top, stats] = await Promise.all([
      listTopAiScanCacheByHitsToday(20),
      getAiScanCacheStatsToday(),
    ]);

    const apiCallsSaved = top.reduce((s, r) => s + Math.max(0, r.hit_count), 0);
    const sonnetOutPerTok = MODEL_PRICING_USD_PER_MTOK.sonnet.output / 1_000_000;
    const estimatedCostSavedUsd =
      Math.round(apiCallsSaved * AI_SCAN_AVG_SAVED_OUTPUT_TOKENS * sonnetOutPerTok * 100) / 100;

    const totalRequestsEstimate = stats.entries + apiCallsSaved;
    const hitRatePct =
      totalRequestsEstimate > 0
        ? Math.round((apiCallsSaved / totalRequestsEstimate) * 1000) / 10
        : 0;

    return NextResponse.json({
      top,
      stats: {
        entriesToday: stats.entries,
        cacheHitsToday: apiCallsSaved,
        estimatedCostSavedUsd,
        hitRatePct,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'stats_failed';
    return NextResponse.json({ error: 'stats_failed', message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireSyncedUser(req);
  if (!auth.ok) return auth.response;
  if (!authorizeAdminRequest(req, auth.user.wallet_address)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: z.infer<typeof FlushBody>;
  try {
    body = FlushBody.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  try {
    await deleteScanCache(body.cacheKey);
    return NextResponse.json({ ok: true, cacheKey: body.cacheKey });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'flush_failed';
    return NextResponse.json({ error: 'flush_failed', message }, { status: 500 });
  }
}
