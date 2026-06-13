#!/usr/bin/env node --import tsx
/**
 * Backfill the top active Pulse mints (Dex 24h volume) with indexer data
 * beyond the QA vertical slice. Run after migrating mint_index_status.
 *
 * Usage:
 *   node --import tsx scripts/backfill-active-mints.ts
 *   node --import tsx scripts/backfill-active-mints.ts --source=pulse_migrated --max=8
 *   node --import tsx scripts/backfill-active-mints.ts --source=manual --mints=AAA,BBB
 *   node --import tsx scripts/backfill-active-mints.ts --dry-run
 */
import { config } from 'dotenv';
import { runMultiMintBackfill, type MultiMintBackfillSource } from '@/lib/indexer/multiMintBackfill';

config({ path: '.env.local' });
config({ path: '.env' });

function arg(name: string, fallback?: string): string | undefined {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : fallback;
}

const source = (arg('source', 'pulse_migrated') ?? 'pulse_migrated') as MultiMintBackfillSource;
const maxMints = Number(arg('max', '6') ?? '6');
const maxPages = Number(arg('pages', '4') ?? '4');
const pageSize = Number(arg('pageSize', '100') ?? '100');
const staleMin = Number(arg('staleMin', '30') ?? '30');
const dryRun = process.argv.includes('--dry-run');
const manualMints = (arg('mints', '') ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

async function main() {
  console.log(
    `[backfill-active-mints] source=${source} maxMints=${maxMints} pages=${maxPages} pageSize=${pageSize} dryRun=${dryRun}`,
  );
  const report = await runMultiMintBackfill({
    source,
    mints: source === 'manual' ? manualMints : undefined,
    maxMints,
    maxPagesPerTarget: maxPages,
    pageSize,
    onlyIfStaleMinutes: staleMin,
    dryRun,
  });
  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error('[backfill-active-mints] FAILED', err);
  process.exit(1);
});
