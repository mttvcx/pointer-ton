import 'server-only';

import { fetchWalletSwapHistory } from '@/lib/indexer/fetchWalletSwapHistory';
import { insertMintSwap } from '@/lib/db/mintSwaps';
import { ensureTokenRowForMint } from '@/lib/helius/feed';
import { fetchUsdPricesForMints } from '@/lib/jupiter/priceTickers';
import { SOL_MINT } from '@/lib/utils/addresses';

/**
 * On-demand, bounded backfill of a single wallet's recent swap history — so the
 * extension's avatar ring / PnL popup can show REAL realized PnL for KOL wallets
 * that the mint-centric indexer hasn't captured. Reuses the proven
 * fetchWalletSwapHistory → insertMintSwap pipeline (insertMintSwap dedups by
 * signature, so re-runs are cheap).
 *
 * Serverless-safe: scheduleWalletIndex() returns the work promise, and the route
 * hands it to Next's after() so Vercel keeps the function alive until the backfill
 * COMPLETES (fire-and-forget gets killed after the response on serverless).
 *
 * Credit safety: per-wallet 30-min in-memory dedup + fetched-only-when mint_swaps is
 * empty (so each wallet indexes once, then has data), small page cap, 429 backoff in
 * fetchWalletSwapHistory, and every run logs an estimated credit cost. Bursts on a
 * fresh timeline are bounded per wallet, not globally capped (instance state isn't
 * shared on serverless) — flip rings to hover-only if credit spend runs hot.
 */

const WINDOW_DAYS = 30;
const MAX_PAGES = 6; // ≤600 txs/wallet ceiling
const DEDUP_MS = 30 * 60 * 1000;

const lastIndexed = new Map<string, number>();
const inFlight = new Set<string>();

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

    // Backfill token metadata (symbols) for the traded mints, so Top Moves reads
    // real names not mint prefixes. ensureTokenRowForMint is DB-first — it only
    // hits DAS for tokens we don't already have. Deduped + capped.
    const mints = [...new Set(res.swaps.map((s) => s.mint))].filter(Boolean).slice(0, 40);
    for (const mint of mints) await ensureTokenRowForMint(mint).catch(() => null);

    lastIndexed.set(address, Date.now());
    console.log(`[ext-index] ${address.slice(0, 8)}… swaps=${res.swaps.length} inserted=${inserted} mints=${mints.length} pages=${res.pagesFetched} credits~${res.creditsEstimated}`);
  } catch (err) {
    console.warn('[ext-index] failed', address.slice(0, 8), err instanceof Error ? err.message : err);
  } finally {
    inFlight.delete(address);
  }
}

/**
 * Start a bounded backfill for `address` unless it was indexed in the last 30 min
 * or is already running. Returns `{ scheduled, work }` — pass `work` to Next's
 * `after()` so the backfill reliably COMPLETES on Vercel serverless (fire-and-forget
 * gets killed after the response there). `scheduled` = indexing is pending.
 */
export function scheduleWalletIndex(address: string): { scheduled: boolean; work: Promise<void> | null } {
  if (inFlight.has(address)) return { scheduled: true, work: null }; // already running
  const last = lastIndexed.get(address);
  if (last != null && Date.now() - last < DEDUP_MS) return { scheduled: false, work: null }; // fresh
  return { scheduled: true, work: runIndex(address) };
}
