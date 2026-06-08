/**
 * Backfill protocol classification columns on existing tokens.
 * Run: npm run backfill:protocol
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Apply scripts/protocol-classification.sql in Supabase first.
 */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import {
  buildClassifierInputFromLaunchEvent,
  ingestHintFromRawMetadata,
  ingestHintFromSource,
} from '../lib/protocol/buildClassifierInput';
import {
  classifyTokenProtocol,
  classificationToDbPatch,
  shouldApplyClassification,
} from '../lib/protocol/classifyCore';
import type { LaunchpadEvent } from '../lib/helius/parsers';
import { inferMintKind } from '../lib/chains/mintKind';
import { PROTOCOL_FILTER_MIN_CONFIDENCE } from '../lib/protocol/types';

config({ path: '.env.local' });
config({ path: '.env' });

const BATCH = 200;

function env(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

function inferChainForStats(mint: string, launchPad: string | null, chainId: string | null): string {
  if (chainId) return chainId;
  if (launchPad === 'eth') return 'eth';
  if (launchPad === 'bsc') return 'bnb';
  if (launchPad === 'base') return 'base';
  if (launchPad === 'ton') return 'ton';
  const kind = inferMintKind(mint);
  if (kind === 'sol') return 'sol';
  if (kind === 'ton') return 'ton';
  if (kind === 'evm') return 'eth';
  return 'unknown';
}

function pointerIngestSource(raw: unknown): string | null {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
  return typeof r?.pointerIngestSource === 'string' ? r.pointerIngestSource : null;
}

function isSolUnknown(row: {
  mint: string;
  launch_pad: string | null;
  chain_id: string | null;
  protocol_id: string | null;
  source_confidence: number | null;
}): boolean {
  if (inferChainForStats(row.mint, row.launch_pad, row.chain_id) !== 'sol') return false;
  const conf = row.source_confidence ?? 0;
  return !row.protocol_id || conf < PROTOCOL_FILTER_MIN_CONFIDENCE;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BackfillSupabase = ReturnType<typeof createClient<any>>;

async function countSolUnknown(supabase: BackfillSupabase): Promise<{ unknown: number; total: number }> {
  const { data, error } = await supabase
    .from('tokens')
    .select('mint, launch_pad, chain_id, protocol_id, source_confidence');
  if (error) throw new Error(error.message);
  let unknown = 0;
  let total = 0;
  for (const row of (data ?? []) as Array<{
    mint: string;
    launch_pad: string | null;
    chain_id: string | null;
    protocol_id: string | null;
    source_confidence: number | null;
  }>) {
    if (inferChainForStats(row.mint, row.launch_pad, row.chain_id) !== 'sol') continue;
    total += 1;
    if (isSolUnknown(row)) unknown += 1;
  }
  return { unknown, total };
}

async function main() {
  const supabase = createClient(env('NEXT_PUBLIC_SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error: preflightErr } = await supabase.from('tokens').select('protocol_id').limit(1);
  if (preflightErr) {
    throw new Error(
      `Preflight failed — apply scripts/protocol-classification.sql first: ${preflightErr.message}`,
    );
  }

  const { count: rowsBefore } = await supabase.from('tokens').select('*', { count: 'exact', head: true });
  const solBefore = await countSolUnknown(supabase);
  console.log(`\n=== Before backfill ===`);
  console.log(`total token rows: ${rowsBefore ?? 0}`);
  console.log(
    `Sol unknown (protocol_id null or confidence < ${PROTOCOL_FILTER_MIN_CONFIDENCE}): ${solBefore.unknown}/${solBefore.total} (${solBefore.total ? ((solBefore.unknown / solBefore.total) * 100).toFixed(1) : '0.0'}%)`,
  );

  let offset = 0;
  let scanned = 0;
  let updated = 0;
  let skippedHigherConfidence = 0;
  let skippedNoPatch = 0;
  let skippedUpdateError = 0;

  for (;;) {
    const { data, error } = await supabase
      .from('tokens')
      .select(
        'mint, launch_pad, raw_metadata, bonding_progress, migrated_at, migrated_to, protocol_id, source_confidence, chain_id, classification_source',
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + BATCH - 1);

    if (error) throw new Error(error.message);
    if (!data?.length) break;

    for (const row of data) {
      scanned += 1;
      const launchpad: LaunchpadEvent['launchpad'] =
        row.launch_pad === 'ton' || row.launch_pad == null
          ? 'unknown'
          : (row.launch_pad as LaunchpadEvent['launchpad']);

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

      const ingestSrc = pointerIngestSource(row.raw_metadata);
      const ingestHint =
        row.migrated_at != null
          ? ingestHintFromSource('migration_program')
          : ingestHintFromRawMetadata(row.raw_metadata) ?? ingestHintFromSource('backfill');

      const dasAuthorityPad = ingestSrc === 'das_authority' && row.launch_pad ? row.launch_pad : null;

      const input = buildClassifierInputFromLaunchEvent(ev, row, {
        ingest_hint: ingestHint,
        launch_pad: row.launch_pad,
        das_authority_pad: dasAuthorityPad,
      });

      const incoming = classifyTokenProtocol(input);

      if (!shouldApplyClassification(row, incoming)) {
        if (row.protocol_id && (row.source_confidence ?? 0) >= (incoming.source_confidence ?? 0)) {
          skippedHigherConfidence += 1;
        } else {
          skippedNoPatch += 1;
        }
        continue;
      }

      const patch = classificationToDbPatch(incoming);
      const { error: upErr } = await supabase.from('tokens').update(patch).eq('mint', row.mint);
      if (upErr) {
        console.warn('[backfill] update error', row.mint, upErr.message);
        skippedUpdateError += 1;
        continue;
      }
      updated += 1;
    }

    offset += data.length;
    console.log(
      `[backfill] progress scanned=${scanned} updated=${updated} skipped_higher_conf=${skippedHigherConfidence}`,
    );
    if (data.length < BATCH) break;
  }

  console.log('\n=== Backfill summary ===');
  console.log(`total rows scanned: ${scanned}`);
  console.log(`rows updated: ${updated}`);
  console.log(`rows skipped (higher confidence existed): ${skippedHigherConfidence}`);
  console.log(`rows skipped (no patch / same classification): ${skippedNoPatch}`);
  console.log(`rows skipped (update error): ${skippedUpdateError}`);

  // Cleanup unrecoverable das_search / das_hydrate wallet holdings
  const { data: candidates, error: candErr } = await supabase
    .from('tokens')
    .select('mint, launch_pad, chain_id, protocol_id, source_confidence, raw_metadata, classification_source');
  if (candErr) throw new Error(candErr.message);

  const garbage = (candidates ?? []).filter((row) => {
    const src = pointerIngestSource(row.raw_metadata);
    if (src !== 'das_search' && src !== 'das_hydrate') return false;
    return isSolUnknown(row);
  });

  console.log(`\n=== Cleanup: unrecoverable das_search/das_hydrate Sol rows ===`);
  console.log(`candidates to delete: ${garbage.length}`);
  if (garbage.length > 0) {
    const bySource = new Map<string, number>();
    for (const g of garbage) {
      const src = pointerIngestSource(g.raw_metadata) ?? 'unknown';
      bySource.set(src, (bySource.get(src) ?? 0) + 1);
    }
    for (const [src, n] of bySource.entries()) {
      console.log(`  ${src}: ${n}`);
    }
    const mints = garbage.map((g) => g.mint);
    for (let i = 0; i < mints.length; i += 50) {
      const chunk = mints.slice(i, i + 50);
      const { error: delErr } = await supabase.from('tokens').delete().in('mint', chunk);
      if (delErr) throw new Error(`cleanup delete failed: ${delErr.message}`);
    }
    console.log(`deleted ${mints.length} rows`);
  }

  const { count: rowsAfter } = await supabase.from('tokens').select('*', { count: 'exact', head: true });
  const solAfter = await countSolUnknown(supabase);

  console.log(`\n=== After backfill + cleanup ===`);
  console.log(`total token rows: ${rowsAfter ?? 0} (removed ${(rowsBefore ?? 0) - (rowsAfter ?? 0)})`);
  console.log(
    `Sol unknown: ${solAfter.unknown}/${solAfter.total} (${solAfter.total ? ((solAfter.unknown / solAfter.total) * 100).toFixed(1) : '0.0'}%)`,
  );

  const { data: sourceBreakdown } = await supabase
    .from('tokens')
    .select('classification_source, protocol_id, source_confidence, launch_pad, chain_id, mint')
    .or('chain_id.eq.sol,launch_pad.in.(pump.fun,bonk,bags,printr,moonshot,heaven,dynamic-bc)');

  const dasAuthority = (sourceBreakdown ?? []).filter((r) => r.classification_source === 'helius_das_authority');
  const dasAuthorityUnknown = dasAuthority.filter((r) => isSolUnknown(r)).length;
  console.log(`\nhelius_das_authority Sol rows: ${dasAuthority.length}, unknown among them: ${dasAuthorityUnknown}`);

  const badBonk = (sourceBreakdown ?? []).filter(
    (r) =>
      r.mint.startsWith('DezXAZ8z') &&
      r.classification_source === 'helius_das_authority' &&
      (r.source_confidence ?? 0) < PROTOCOL_FILTER_MIN_CONFIDENCE,
  );
  if (badBonk.length > 0) {
    console.warn(`WARN: Bonk still has misleading helius_das_authority @ low confidence (${badBonk.length})`);
  } else {
    console.log('Bonk misleading helius_das_authority @ 0.000: none');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
