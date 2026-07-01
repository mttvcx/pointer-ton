import 'server-only';

import { fetchWalletSwapHistory } from '@/lib/indexer/fetchWalletSwapHistory';
import { insertMintSwap } from '@/lib/db/mintSwaps';
import { fetchUsdPricesForMints } from '@/lib/jupiter/priceTickers';
import { SOL_MINT } from '@/lib/utils/addresses';

/**
 * On-demand, bounded backfill of a single wallet's recent swap history — so the
 * extension's avatar ring / PnL popup can show REAL realized PnL for KOL wallets
 * that the mint-centric indexer hasn't captured. Reuses the proven
 * fetchWalletSwapHistory → insertMintSwap pipeline (insertMintSwap dedups by
 * signature, so re-runs are cheap).
 *
 * Credit safety: fire-and-forget queue, per-wallet 30-min dedup, small page cap,
 * and a low concurrency cap so a timeline full of KOLs can't burst Helius. Every
 * run logs an estimated credit cost.
 *
 * NOTE: fire-and-forget works on a long-lived dev server. On Vercel serverless the
 * post-response work isn't guaranteed — production should drive this from a queue
 * / cron (the existing runRefreshKolStats cron already covers the curated pack).
 */

const WINDOW_DAYS = 30;
const MAX_PAGES = 6; // ≤600 txs/wallet ceiling
const DEDUP_MS = 30 * 60 * 1000;
const MAX_CONCURRENT = 3;

const lastIndexed = new Map<string, number>();
const inFlight = new Set<string>();
const queue: string[] = [];
let running = 0;

async function solUsdSpot(): Promise<number | null> {
  try {
    const prices = await fetchUsdPricesForMints([SOL_MINT]);
    const px = prices.get(SOL_MINT)?.usdPrice;
    return px != null && Number.isFinite(px) ? px : null;
  } catch {
    return null;
  }
}

async function runIndex(address: string): Promise<void> {
  inFlight.add(address);
  running += 1;
  try {
    const solUsd = await solUsdSpot();
    const res = await fetchWalletSwapHistory(address, {
      solUsd,
      sinceMs: Date.now() - WINDOW_DAYS * 86_400_000,
      maxPages: MAX_PAGES,
      pageDelayMs: 150,
    });
    let inserted = 0;
    for (const swap of res.swaps) {
      const r = await insertMintSwap(swap).catch(() => 'error' as const);
      if (r === 'inserted') inserted += 1;
    }
    lastIndexed.set(address, Date.now());
    console.log(`[ext-index] ${address.slice(0, 8)}… swaps=${res.swaps.length} inserted=${inserted} pages=${res.pagesFetched} credits~${res.creditsEstimated}`);
  } catch (err) {
    console.warn('[ext-index] failed', address.slice(0, 8), err instanceof Error ? err.message : err);
  } finally {
    inFlight.delete(address);
    running -= 1;
    pump();
  }
}

function pump(): void {
  while (running < MAX_CONCURRENT && queue.length > 0) {
    const next = queue.shift();
    if (!next || inFlight.has(next)) continue;
    void runIndex(next);
  }
}

/**
 * Schedule a bounded backfill for `address` unless it was indexed in the last
 * 30 min or is already queued/running. Returns true if indexing is now pending.
 */
export function scheduleWalletIndex(address: string): boolean {
  const last = lastIndexed.get(address);
  if (last != null && Date.now() - last < DEDUP_MS) return false;
  if (inFlight.has(address) || queue.includes(address)) return true;
  queue.push(address);
  pump();
  return true;
}
