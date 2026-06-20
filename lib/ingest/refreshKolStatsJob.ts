import 'server-only';

import { starterKolEntriesForChain } from '@/lib/track/starterKolPacks';
import { fetchWalletSwapHistory } from '@/lib/indexer/fetchWalletSwapHistory';
import { insertMintSwap } from '@/lib/db/mintSwaps';
import { fetchUsdPricesForMints } from '@/lib/jupiter/priceTickers';
import { SOL_MINT } from '@/lib/utils/addresses';

/**
 * Incremental refresh of the curated KOL pack's swap history.
 *
 * Design (matches the opt-in/curated model — these 45 are a fixed shared list,
 * not per-user polling):
 *  - Rotate through the KOLs a small SLICE at a time (by 15-min time bucket) so
 *    each invocation stays well within the function duration + Helius rate
 *    budget. Full cycle ≈ SLICE_COUNT × 15min.
 *  - Only pull the most recent MAX_PAGES per wallet — `insertMintSwap` dedups
 *    by (signature,wallet,mint,event_kind), so old swaps are skipped for free
 *    and only genuinely new trades cost anything.
 *  - Does NOT aggregate — the hourly /api/cron/aggregate-wallet-stats job
 *    recomputes wallet_stats from the freshened mint_swaps.
 */

const SLICE = 5; // KOLs per invocation
const MAX_PAGES = 3; // recent pages only — incremental
const WINDOW_DAYS = 30;
const BUCKET_MS = 15 * 60 * 1000;

function dedupedKolWallets(): string[] {
  const seen = new Set<string>();
  return starterKolEntriesForChain('sol')
    .map((k) => k.wallet.trim())
    .filter((w) => w && !seen.has(w) && (seen.add(w), true));
}

async function solUsdSpot(): Promise<number | null> {
  try {
    const prices = await fetchUsdPricesForMints([SOL_MINT]);
    const px = prices.get(SOL_MINT)?.usdPrice;
    return px != null && Number.isFinite(px) ? px : null;
  } catch {
    return null;
  }
}

export async function runRefreshKolStats(): Promise<{
  skipped?: boolean;
  sliceIndex: number;
  sliceCount: number;
  walletsRefreshed: number;
  swapsInserted: number;
  creditsEstimated: number;
}> {
  const kols = dedupedKolWallets();
  const sliceCount = Math.max(1, Math.ceil(kols.length / SLICE));

  if (!process.env.HELIUS_API_KEY?.trim() || kols.length === 0) {
    return { skipped: true, sliceIndex: 0, sliceCount, walletsRefreshed: 0, swapsInserted: 0, creditsEstimated: 0 };
  }

  // Rotate by time bucket — no persisted cursor needed.
  const sliceIndex = Math.floor(Date.now() / BUCKET_MS) % sliceCount;
  const batch = kols.slice(sliceIndex * SLICE, sliceIndex * SLICE + SLICE);

  const solUsd = await solUsdSpot();
  const sinceMs = Date.now() - WINDOW_DAYS * 86_400_000;

  let swapsInserted = 0;
  let creditsEstimated = 0;

  for (const wallet of batch) {
    try {
      const res = await fetchWalletSwapHistory(wallet, {
        solUsd,
        sinceMs,
        maxPages: MAX_PAGES,
        pageDelayMs: 200,
      });
      creditsEstimated += res.creditsEstimated;
      for (const swap of res.swaps) {
        const r = await insertMintSwap(swap).catch(() => 'error' as const);
        if (r === 'inserted') swapsInserted += 1;
      }
    } catch (err) {
      console.warn('[refresh-kol-stats] wallet failed', wallet.slice(0, 8), err instanceof Error ? err.message : err);
    }
  }

  return { sliceIndex, sliceCount, walletsRefreshed: batch.length, swapsInserted, creditsEstimated };
}
