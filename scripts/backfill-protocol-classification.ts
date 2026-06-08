/**
 * Backfill protocol classification columns on existing tokens.
 * Run: npx tsx scripts/backfill-protocol-classification.ts
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Apply scripts/protocol-classification.sql in Supabase first.
 */
import { createClient } from '@supabase/supabase-js';
import { buildClassifierInputFromLaunchEvent } from '../lib/protocol/buildClassifierInput';
import { classificationPatchForIngest } from '../lib/protocol/applyClassification';
import type { LaunchpadEvent } from '../lib/helius/parsers';

const BATCH = 200;

function env(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

async function main() {
  const supabase = createClient(env('NEXT_PUBLIC_SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let offset = 0;
  let updated = 0;
  let skipped = 0;

  for (;;) {
    const { data, error } = await supabase
      .from('tokens')
      .select(
        'mint, launch_pad, raw_metadata, bonding_progress, migrated_at, migrated_to, protocol_id, source_confidence',
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + BATCH - 1);

    if (error) throw new Error(error.message);
    if (!data?.length) break;

    for (const row of data) {
      const launchpad = (row.launch_pad ?? 'unknown') as LaunchpadEvent['launchpad'];
      const ev: LaunchpadEvent = {
        launchpad,
        mint: row.mint,
        creator_wallet: null,
        symbol: null,
        name: null,
        image_url: null,
        initial_liquidity_sol: null,
        bonding_progress: row.bonding_progress,
        raw: row.raw_metadata ?? {},
      };

      const input = buildClassifierInputFromLaunchEvent(ev, row, {
        ingest_hint: row.migrated_at ? 'migration_program' : 'backfill',
      });

      const patch = classificationPatchForIngest(input, row);
      if (!patch) {
        skipped += 1;
        continue;
      }

      const { error: upErr } = await supabase.from('tokens').update(patch).eq('mint', row.mint);
      if (upErr) {
        console.warn('[backfill] skip', row.mint, upErr.message);
        skipped += 1;
        continue;
      }
      updated += 1;
    }

    offset += data.length;
    console.log(`[backfill] processed ${offset} rows (${updated} updated, ${skipped} skipped)`);
    if (data.length < BATCH) break;
  }

  console.log(`[backfill] done — updated ${updated}, skipped ${skipped}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
