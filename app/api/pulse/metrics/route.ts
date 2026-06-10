import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { fetchPulseMetricsForMints } from '@/lib/market/pulseMetricsEnrich';
import { isValidPublicKey } from '@/lib/utils/addresses';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const QuerySchema = z.object({
  mints: z.string().min(1),
});

/** Batch holder metrics for visible Pulse rows (client hydration after feed load). */
export async function GET(req: NextRequest) {
  const parsed = QuerySchema.safeParse({
    mints: req.nextUrl.searchParams.get('mints') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_query' }, { status: 400 });
  }

  const mints = parsed.data.mints
    .split(',')
    .map((m) => m.trim())
    .filter((m) => isValidPublicKey(m));

  if (mints.length === 0) {
    return NextResponse.json({ metrics: {} });
  }

  try {
    const metrics = await fetchPulseMetricsForMints(mints);
    return NextResponse.json(
      { metrics },
      { headers: { 'Cache-Control': 'private, max-age=8' } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'metrics_failed';
    return NextResponse.json({ error: message, metrics: {} }, { status: 500 });
  }
}
