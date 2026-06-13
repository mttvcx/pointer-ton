import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { isFounderBetaMode } from '@/lib/beta/founderBeta';
import { runMultiMintBackfill, type MultiMintBackfillSource } from '@/lib/indexer/multiMintBackfill';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  source: z.enum(['pulse_active', 'pulse_migrated', 'pulse_new', 'manual']).default('pulse_migrated'),
  mints: z.array(z.string().min(32).max(60)).max(20).optional(),
  maxMints: z.number().int().min(1).max(20).default(6),
  maxPagesPerTarget: z.number().int().min(1).max(20).default(4),
  pageSize: z.number().int().min(10).max(100).default(100),
  onlyIfStaleMinutes: z.number().int().min(1).max(60 * 24).default(30),
  dryRun: z.boolean().default(false),
});

export async function POST(req: NextRequest) {
  // Safety: this is an expensive operation. Require an internal auth header OR
  // founder beta in dev. In production, no header = no go.
  const authHeader = req.headers.get('x-pointer-internal')?.trim();
  const internalOk = authHeader && authHeader === (process.env.POINTER_CRON_SECRET ?? '');
  const devOk = isFounderBetaMode() && process.env.NODE_ENV !== 'production';
  if (!internalOk && !devOk) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_body', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const opts = parsed.data;
  if (opts.source === 'manual' && (!opts.mints || opts.mints.length === 0)) {
    return NextResponse.json({ error: 'manual_requires_mints' }, { status: 400 });
  }

  try {
    const report = await runMultiMintBackfill({
      source: opts.source as MultiMintBackfillSource,
      mints: opts.mints,
      maxMints: opts.maxMints,
      maxPagesPerTarget: opts.maxPagesPerTarget,
      pageSize: opts.pageSize,
      onlyIfStaleMinutes: opts.onlyIfStaleMinutes,
      dryRun: opts.dryRun,
    });
    return NextResponse.json(report);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'backfill_failed';
    return NextResponse.json({ error: 'backfill_failed', message }, { status: 500 });
  }
}
