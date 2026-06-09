/**
 * QA mint chain swap backfill (Helius enhanced tx → mint_swaps).
 *
 * Run: npm run backfill:qa-swaps
 * Dry run: npm run backfill:qa-swaps -- --dry-run
 */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { backfillQaMintSwaps, qaIndexerStatus } from '../lib/indexer/backfillQaMintSwaps';

config({ path: '.env.local' });
config({ path: '.env' });

function env(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const maxPagesArg = process.argv.find((a) => a.startsWith('--max-pages='));
  const maxPages = maxPagesArg ? Number(maxPagesArg.split('=')[1]) : undefined;

  const url = process.env.SUPABASE_SERVICE_URL?.trim() || env('NEXT_PUBLIC_SUPABASE_URL');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log('[qa-backfill] starting', { dryRun, maxPages });

  const report = await backfillQaMintSwaps(supabase, { dryRun, maxPagesPerTarget: maxPages });
  const status = dryRun ? null : await qaIndexerStatus(supabase, report.mint);

  console.log('\n=== QA Mint Swap Backfill Report ===');
  console.log('mint:', report.mint);
  console.log('dryRun:', report.dryRun);
  console.log('targets:');
  for (const t of report.targets) {
    console.log(`  - [${t.kind}] ${t.address} — ${t.reason}`);
  }
  console.log('signaturesFetched:', report.signaturesFetched);
  console.log('transactionsParsed:', report.transactionsParsed);
  console.log('swapsParsed:', report.swapsParsed);
  console.log('swapsInserted:', report.swapsInserted);
  console.log('swapsSkippedDuplicate:', report.swapsSkippedDuplicate);
  console.log('parserFailures:', report.parserFailures);
  if (report.failureSamples.length) {
    console.log('failureSamples:', report.failureSamples);
  }
  console.log('walletsDerived:', report.walletsDerived);
  console.log('topTraderCount:', report.topTraderCount);
  console.log('heliusCalls:', report.heliusCalls);
  console.log('creditsEstimated:', report.creditsEstimated);
  if (status) {
    console.log('supabase mint_swaps:', status.swapCount);
    console.log('supabase mint_wallet_stats:', status.walletCount);
  }
}

main().catch((err) => {
  console.error('[qa-backfill] failed:', err);
  process.exit(1);
});
