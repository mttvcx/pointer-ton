import 'server-only';

import { APP_CHAIN_IDS, type AppChainId } from '@/lib/chains/appChain';
import { inferMintKind } from '@/lib/chains/mintKind';
import {
  bundlePulseTokens,
  listPulseFeedTokens,
} from '@/lib/db/tokens';
import { listRetryableFailedMints } from '@/lib/db/mintIndexStatus';
import { runScheduledPulsePoll } from '@/lib/helius/feed';
import { runMultiMintBackfill, type MultiMintBackfillReport } from '@/lib/indexer/multiMintBackfill';
import { backfillMintSwaps } from '@/lib/indexer/backfillMintSwaps';
import { createAdminSupabase } from '@/lib/supabase/server';
import {
  enrichPulseBundlesWithDexScreener,
  persistPulseDexSnapshots,
} from '@/lib/market/dexscreenerPulse';
import {
  enrichPulseBundlesWithMetrics,
  persistPulseBundle,
} from '@/lib/market/pulseMetricsEnrich';
import { PULSE_COLUMNS, type PulseColumnId } from '@/lib/utils/constants';
import { withTimeout } from '@/lib/utils/withTimeout';
import type { PulseTokenBundle } from '@/types/tokens';

const ENRICH_PER_COLUMN = 24;
const ENRICH_DEX_TIMEOUT_MS = 12_000;
const ENRICH_METRICS_TIMEOUT_MS = 20_000;

export type DiscoverTokensReport = Awaited<ReturnType<typeof runScheduledPulsePoll>> & {
  paused: boolean;
};

/** Poll launchpads / DAS / Gecko / TonAPI — insert new token rows. */
export async function runDiscoverTokens(): Promise<DiscoverTokensReport> {
  if (process.env.POINTER_PAUSE_INGEST === '1') {
    return {
      paused: true,
      tonapi: 0,
      solDas: 0,
      geckoEth: 0,
      geckoBsc: 0,
      geckoBase: 0,
    };
  }
  const poll = await runScheduledPulsePoll();
  return { paused: false, ...poll };
}

async function collectPulseBundlesForChain(chain: AppChainId): Promise<PulseTokenBundle[]> {
  const mintSeen = new Set<string>();
  const tokens: Awaited<ReturnType<typeof listPulseFeedTokens>> = [];

  for (const column of PULSE_COLUMNS) {
    const rows = await listPulseFeedTokens(column, chain, ENRICH_PER_COLUMN);
    for (const row of rows) {
      if (mintSeen.has(row.mint)) continue;
      mintSeen.add(row.mint);
      tokens.push(row);
    }
  }

  return bundlePulseTokens(tokens);
}

export type EnrichPulseReport = {
  chains: AppChainId[];
  tokensConsidered: number;
  dexPersisted: number;
  metricsPersisted: number;
  perChain: Partial<
    Record<
      AppChainId,
      { considered: number; dexPersisted: number; metricsPersisted: number }
    >
  >;
};

/**
 * Dex + holder/pump/social enrichment for visible Pulse rows. Persists snapshots
 * and token patches so the next feed fetch is not empty `--`.
 */
export async function runEnrichPulse(): Promise<EnrichPulseReport> {
  if (process.env.POINTER_PAUSE_INGEST === '1') {
    return { chains: [], tokensConsidered: 0, dexPersisted: 0, metricsPersisted: 0, perChain: {} };
  }

  const report: EnrichPulseReport = {
    chains: [...APP_CHAIN_IDS],
    tokensConsidered: 0,
    dexPersisted: 0,
    metricsPersisted: 0,
    perChain: {},
  };

  for (const chain of APP_CHAIN_IDS) {
    let bundles = await collectPulseBundlesForChain(chain);
    if (bundles.length === 0) continue;

    report.tokensConsidered += bundles.length;
    const chainStats = { considered: bundles.length, dexPersisted: 0, metricsPersisted: 0 };

    try {
      const dexEnriched = await withTimeout(
        enrichPulseBundlesWithDexScreener(bundles, chain),
        ENRICH_DEX_TIMEOUT_MS,
        `enrich_dex_${chain}`,
      );
      chainStats.dexPersisted = await persistPulseDexSnapshots(dexEnriched);
      bundles = dexEnriched;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[pointer][enrich-pulse] dex ${chain} failed:`, msg);
    }

    if (chain === 'sol') {
      try {
        const before = new Map(bundles.map((b) => [b.token.mint, b]));
        const metricsEnriched = await withTimeout(
          enrichPulseBundlesWithMetrics(bundles, chain),
          ENRICH_METRICS_TIMEOUT_MS,
          'enrich_metrics_sol',
        );
        for (const bundle of metricsEnriched) {
          const prev = before.get(bundle.token.mint);
          if (!prev) continue;
          const snapDirty =
            JSON.stringify(prev.snapshot) !== JSON.stringify(bundle.snapshot);
          const tokenDirty =
            JSON.stringify(prev.token) !== JSON.stringify(bundle.token);
          if (snapDirty || tokenDirty) {
            await persistPulseBundle(bundle, tokenDirty);
            chainStats.metricsPersisted += 1;
          }
        }
        bundles = metricsEnriched;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn('[pointer][enrich-pulse] metrics sol failed:', msg);
      }
    }

    report.dexPersisted += chainStats.dexPersisted;
    report.metricsPersisted += chainStats.metricsPersisted;
    report.perChain[chain] = chainStats;
  }

  return report;
}

export type IndexActiveMintsReport = MultiMintBackfillReport;

/** Index Solana mints currently visible on Pulse (new + stretch + migrated). */
export async function runIndexActiveMints(opts?: {
  maxMints?: number;
  onlyIfStaleMinutes?: number;
}): Promise<IndexActiveMintsReport> {
  if (process.env.POINTER_PAUSE_INGEST === '1') {
    return {
      source: 'pulse_active',
      candidateCount: 0,
      indexedCount: 0,
      skippedAlreadyIndexedCount: 0,
      failedCount: 0,
      perMint: [],
      totalHeliusCalls: 0,
      totalCreditsEstimated: 0,
      totalSwapsInserted: 0,
    };
  }
  return runMultiMintBackfill({
    source: 'pulse_active',
    maxMints: opts?.maxMints ?? 8,
    maxPagesPerTarget: 4,
    pageSize: 100,
    onlyIfStaleMinutes: opts?.onlyIfStaleMinutes ?? 20,
  });
}

export type RetryFailedIndexesReport = {
  candidateCount: number;
  retriedCount: number;
  succeededCount: number;
  failedCount: number;
  totalHeliusCalls: number;
  totalSwapsInserted: number;
};

/** Re-attempt mints that previously failed indexing (bounded, with stale gate). */
export async function runRetryFailedIndexes(opts?: {
  maxMints?: number;
  minAgeMinutes?: number;
}): Promise<RetryFailedIndexesReport> {
  if (process.env.POINTER_PAUSE_INGEST === '1') {
    return {
      candidateCount: 0,
      retriedCount: 0,
      succeededCount: 0,
      failedCount: 0,
      totalHeliusCalls: 0,
      totalSwapsInserted: 0,
    };
  }

  const maxMints = Math.max(1, Math.min(10, opts?.maxMints ?? 4));
  const minAgeMinutes = opts?.minAgeMinutes ?? 15;
  const candidates = await listRetryableFailedMints(maxMints, minAgeMinutes);
  const solMints = candidates.filter((m) => inferMintKind(m) === 'sol');

  const supabase = createAdminSupabase();
  let retriedCount = 0;
  let succeededCount = 0;
  let failedCount = 0;
  let totalHeliusCalls = 0;
  let totalSwapsInserted = 0;

  for (const mint of solMints) {
    retriedCount += 1;
    try {
      const r = await backfillMintSwaps(supabase, {
        mint,
        maxPagesPerTarget: 3,
        pageSize: 80,
      });
      totalHeliusCalls += r.heliusCalls;
      totalSwapsInserted += r.swapsInserted;
      succeededCount += 1;
    } catch (err) {
      failedCount += 1;
      try {
        await supabase.from('mint_index_status').upsert(
          {
            mint,
            status: 'failed',
            last_error: err instanceof Error ? err.message : 'retry_failed',
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
    candidateCount: solMints.length,
    retriedCount,
    succeededCount,
    failedCount,
    totalHeliusCalls,
    totalSwapsInserted,
  };
}

/** Count Pulse rows per chain/column for verification dashboards. */
export async function countPulseRows(): Promise<
  Record<AppChainId, Record<PulseColumnId, number>>
> {
  const out = {} as Record<AppChainId, Record<PulseColumnId, number>>;
  for (const chain of APP_CHAIN_IDS) {
    const cols = {} as Record<PulseColumnId, number>;
    for (const column of PULSE_COLUMNS) {
      cols[column] = (await listPulseFeedTokens(column, chain, 200)).length;
    }
    out[chain] = cols;
  }
  return out;
}
