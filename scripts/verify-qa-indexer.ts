/**
 * QA chain indexer health check — DB counts + latest swap + top traders.
 *
 * Run: npm run verify:qa-indexer
 */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { fetchQaIndexerSnapshot } from '../lib/indexer/qaMintIngest';
import { getPointerQaMintClient } from '../lib/qa/pointerQaMintClient';

config({ path: '.env.local' });
config({ path: '.env' });

function env(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

async function main() {
  const url = process.env.SUPABASE_SERVICE_URL?.trim() || env('NEXT_PUBLIC_SUPABASE_URL');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const mint = getPointerQaMintClient();
  const snap = await fetchQaIndexerSnapshot(supabase, mint);

  console.log('=== QA Indexer Verify ===');
  console.log('mint:', snap.mint);
  console.log('mint_swaps count:', snap.swapCount);
  console.log('mint_wallet_stats count:', snap.walletStatsCount);
  console.log('top trader count:', snap.topTraderCount);
  if (snap.latestSwap) {
    console.log('latest swap time:', snap.latestSwap.blockTime);
    console.log('latest swap side:', snap.latestSwap.side);
    console.log('latest swap wallet:', snap.latestSwap.wallet);
    console.log('latest swap signature:', snap.latestSwap.signature);
  } else {
    console.log('latest swap: (none)');
  }
  console.log('parser failure count:', snap.parserFailureCount ?? 'n/a (batch only)');
}

main().catch((err) => {
  console.error('[verify] failed:', err);
  process.exit(1);
});
