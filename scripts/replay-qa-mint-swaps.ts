/**
 * Incremental QA mint swap replay — fetches latest pool txs via Helius REST,
 * upserts mint_swaps, recomputes mint_wallet_stats. Safe to run twice (idempotent).
 *
 * Run: npm run replay:qa-swaps
 *      npm run replay:qa-swaps -- --limit=30 --pages=2
 */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import {
  fetchQaIndexerSnapshot,
  replayLatestQaMintSwaps,
} from '../lib/indexer/qaMintIngest';

config({ path: '.env.local' });
config({ path: '.env' });

function env(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

function parseArgs() {
  const limitArg = process.argv.find((a) => a.startsWith('--limit='));
  const pagesArg = process.argv.find((a) => a.startsWith('--pages='));
  return {
    limit: limitArg ? Number(limitArg.split('=')[1]) : 50,
    pages: pagesArg ? Number(pagesArg.split('=')[1]) : 1,
  };
}

async function main() {
  const { limit, pages } = parseArgs();
  const url = process.env.SUPABASE_SERVICE_URL?.trim() || env('NEXT_PUBLIC_SUPABASE_URL');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const before = await fetchQaIndexerSnapshot(supabase);
  console.log('[replay] swaps before:', before.swapCount);

  const report = await replayLatestQaMintSwaps(supabase, { limit, pages, recomputeStats: true });

  const after = await fetchQaIndexerSnapshot(supabase);

  console.log('\n=== QA Mint Swap Replay ===');
  console.log('mint:', report.mint);
  console.log('heliusCalls:', report.heliusCalls);
  console.log('creditsEstimated:', report.creditsEstimated);
  console.log('transactionsSeen (QA mint):', report.transactionsSeen);
  console.log('swapsParsed:', report.swapsParsed);
  console.log('swapsInserted:', report.swapsInserted);
  console.log('swapsSkippedDuplicate:', report.swapsSkippedDuplicate);
  console.log('parserFailures:', report.parserFailures);
  if (report.failureSamples.length) console.log('failureSamples:', report.failureSamples);
  console.log('walletsDerived:', report.walletsDerived);
  console.log('topTraderCount:', report.topTraderCount);
  console.log('\n--- counts ---');
  console.log('swaps before:', before.swapCount);
  console.log('swaps after:', after.swapCount);
  console.log('new swaps:', after.swapCount - before.swapCount);
  console.log('wallet stats:', after.walletStatsCount);
  if (after.latestSwap) {
    console.log('latest swap:', after.latestSwap.blockTime, after.latestSwap.side, after.latestSwap.wallet);
  }
}

main().catch((err) => {
  console.error('[replay] failed:', err);
  process.exit(1);
});
