import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config as loadDotenv } from 'dotenv';
import { backfillMintSwaps, type GeneralBackfillReport } from '@/lib/indexer/backfillMintSwaps';
import type { Tables } from '@/lib/supabase/types';
type TokenMarketSnapshotRow = Tables<'token_market_snapshots'>;

loadDotenv({ path: '.env.local' });
loadDotenv({ path: '.env' });

function createAdminSupabase(): SupabaseClient {
  const url = process.env.SUPABASE_SERVICE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function getLatestSnapshotsForMints(
  supabase: SupabaseClient,
  mints: string[],
): Promise<Map<string, TokenMarketSnapshotRow>> {
  const map = new Map<string, TokenMarketSnapshotRow>();
  if (mints.length === 0) return map;
  const { data, error } = await supabase
    .from('token_market_snapshots')
    .select('*')
    .in('mint', mints)
    .order('snapshot_at', { ascending: false })
    .limit(mints.length * 2);
  if (error) {
    throw new Error(`getLatestSnapshotsForMints failed: ${error.message}`);
  }
  for (const row of (data ?? []) as TokenMarketSnapshotRow[]) {
    if (!map.has(row.mint)) map.set(row.mint, row);
  }
  return map;
}

export type MultiMintBackfillSource = 'pulse_active' | 'pulse_migrated' | 'pulse_new' | 'manual';

export type MultiMintBackfillOptions = {
  /** Pick which Pulse population to index. */
  source: MultiMintBackfillSource;
  /** Override mint list (used for "manual" source). */
  mints?: string[];
  /** Cap mints processed this call. Default 6. */
  maxMints?: number;
  /** Pages per target per mint. Default 4. */
  maxPagesPerTarget?: number;
  /** Page size. Default 100. */
  pageSize?: number;
  /** Only index mints whose mint_index_status is missing or older than this many minutes. */
  onlyIfStaleMinutes?: number;
  /** When true, just list candidates without indexing. */
  dryRun?: boolean;
};

export type MultiMintBackfillReport = {
  source: MultiMintBackfillSource;
  candidateCount: number;
  indexedCount: number;
  skippedAlreadyIndexedCount: number;
  failedCount: number;
  perMint: GeneralBackfillReport[];
  totalHeliusCalls: number;
  totalCreditsEstimated: number;
  totalSwapsInserted: number;
};

async function listActivePulseMints(
  supabase: ReturnType<typeof createAdminSupabase>,
  source: MultiMintBackfillSource,
  maxMints: number,
): Promise<{ mints: string[]; reason: string }> {
  if (source === 'manual') {
    return { mints: [], reason: 'manual — must pass opts.mints' };
  }
  const column = source === 'pulse_active' ? 'migrated' : source === 'pulse_migrated' ? 'migrated' : 'new';
  void column;
  // The /api/pulse/feed already aggregates by DexScreener volume. We mirror
  // the same query: order tokens by latest snapshot volume_24h, only those
  // with non-null latest snapshot.
  const { data, error } = await supabase
    .from('tokens')
    .select('mint, last_seen_at')
    .order('last_seen_at', { ascending: false })
    .limit(400);
  if (error) throw new Error(`listActivePulseMints failed: ${error.message}`);

  const mints = (data ?? []).map((r) => r.mint).filter(Boolean) as string[];
  const snaps = await getLatestSnapshotsForMints(supabase, mints);

  // Sort by 24h volume desc, only keep ones with a snapshot.
  const ranked = mints
    .map((m) => ({ mint: m, snap: snaps.get(m) ?? null }))
    .filter((r) => r.snap)
    .sort((a, b) => (b.snap?.volume_24h_usd ?? 0) - (a.snap?.volume_24h_usd ?? 0))
    .slice(0, maxMints)
    .map((r) => r.mint);

  return { mints: ranked, reason: `top ${ranked.length} by Dex 24h volume` };
}

async function listAlreadyIndexedMints(
  supabase: ReturnType<typeof createAdminSupabase>,
  candidates: string[],
  staleMinutes: number,
): Promise<Set<string>> {
  if (candidates.length === 0) return new Set();
  const cutoff = new Date(Date.now() - staleMinutes * 60_000).toISOString();
  const { data, error } = await supabase
    .from('mint_index_status')
    .select('mint, status, updated_at')
    .in('mint', candidates)
    .eq('status', 'indexed')
    .gte('updated_at', cutoff);
  if (error) {
    if (error.message?.includes('does not exist')) return new Set();
    return new Set();
  }
  return new Set(((data ?? []) as { mint: string }[]).map((r) => r.mint));
}

/**
 * Indexes the top active Pulse mints (Dex 24h volume) up to a per-call cap.
 * Rate-limited: bounded Helius calls, dedupes by signature, idempotent upsert.
 */
export async function runMultiMintBackfill(
  opts: MultiMintBackfillOptions,
): Promise<MultiMintBackfillReport> {
  const supabase = createAdminSupabase();
  const maxMints = Math.max(1, Math.min(20, opts.maxMints ?? 6));
  const onlyIfStaleMinutes = opts.onlyIfStaleMinutes ?? 30;

  let candidateList: string[];
  if (opts.source === 'manual') {
    candidateList = (opts.mints ?? []).map((m) => m.trim()).filter(Boolean).slice(0, maxMints);
  } else {
    const res = await listActivePulseMints(supabase, opts.source, maxMints);
    candidateList = res.mints;
  }

  const alreadyIndexed = await listAlreadyIndexedMints(
    supabase,
    candidateList,
    onlyIfStaleMinutes,
  );

  const toIndex = candidateList.filter((m) => !alreadyIndexed.has(m));
  const perMint: GeneralBackfillReport[] = [];
  let totalHeliusCalls = 0;
  let totalCreditsEstimated = 0;
  let totalSwapsInserted = 0;
  let failedCount = 0;

  for (const mint of toIndex) {
    if (opts.dryRun) {
      // Use a tiny dry-run to count without writing.
      try {
        const r = await backfillMintSwaps(supabase, {
          mint,
          maxPagesPerTarget: 1,
          pageSize: 25,
          dryRun: true,
          recordStatus: false,
        });
        perMint.push(r);
        totalHeliusCalls += r.heliusCalls;
        totalCreditsEstimated += r.creditsEstimated;
      } catch (err) {
        failedCount += 1;
      }
      continue;
    }
    try {
      const r = await backfillMintSwaps(supabase, {
        mint,
        maxPagesPerTarget: opts.maxPagesPerTarget ?? 4,
        pageSize: opts.pageSize ?? 100,
      });
      perMint.push(r);
      totalHeliusCalls += r.heliusCalls;
      totalCreditsEstimated += r.creditsEstimated;
      totalSwapsInserted += r.swapsInserted;
    } catch (err) {
      failedCount += 1;
      try {
        await supabase.from('mint_index_status').upsert(
          {
            mint,
            status: 'failed',
            last_error: err instanceof Error ? err.message : 'backfill_failed',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'mint' },
        );
      } catch {
        /* swallow */
      }
    }
  }

  return {
    source: opts.source,
    candidateCount: candidateList.length,
    indexedCount: perMint.length,
    skippedAlreadyIndexedCount: alreadyIndexed.size,
    failedCount,
    perMint,
    totalHeliusCalls,
    totalCreditsEstimated,
    totalSwapsInserted,
  };
}
