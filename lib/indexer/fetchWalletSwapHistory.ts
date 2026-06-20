import 'server-only';

import {
  fetchHeliusAddressTransactions,
  type HeliusEnhancedTx,
} from '@/lib/indexer/heliusEnhanced';
import { parseSwapFromEnhancedTx } from '@/lib/indexer/parseSwapFromEnhancedTx';
import type { ParsedMintSwap } from '@/lib/indexer/types';

/**
 * Wallet-centric swap backfill for KOL / tracked-wallet PnL.
 *
 * The mint-centric backfill (`backfillMintSwaps`) already pages Helius enhanced
 * txs and parses them with `parseSwapFromEnhancedTx`. That parser keys the swap
 * off `tx.feePayer`, so pulling a KOL's *own* address history and parsing each
 * tx yields that KOL's trades directly — we just feed the result into the same
 * `insertMintSwap → deriveWalletStats → aggregateGlobalWalletStats` pipeline.
 *
 * Cost control: `computeWalletStatsRows` only uses a 30-day window, so we stop
 * paging once the page's oldest tx is older than `sinceMs`.
 */

const WSOL_MINT = 'So11111111111111111111111111111111111111112';

/** Non-SOL mints this wallet moved in a tx — swap candidates to parse. */
function candidateMintsForWallet(tx: HeliusEnhancedTx, wallet: string): string[] {
  const mints = new Set<string>();
  for (const leg of tx.tokenTransfers ?? []) {
    if (!leg.mint || leg.mint === WSOL_MINT) continue;
    if (leg.fromUserAccount === wallet || leg.toUserAccount === wallet) {
      mints.add(leg.mint);
    }
  }
  return [...mints];
}

export type WalletSwapHistoryResult = {
  swaps: ParsedMintSwap[];
  pagesFetched: number;
  heliusCalls: number;
  txScanned: number;
  parserFailures: number;
  creditsEstimated: number;
  reachedWindowEdge: boolean;
};

export async function fetchWalletSwapHistory(
  address: string,
  opts: {
    solUsd: number | null;
    sinceMs: number;
    /** Hard page cap per wallet (100 txs/page). Default 40 = 4k tx ceiling. */
    maxPages?: number;
    /** ms between pages (rate-limit guard). */
    pageDelayMs?: number;
  },
): Promise<WalletSwapHistoryResult> {
  const maxPages = opts.maxPages ?? 40;
  const sinceSec = Math.floor(opts.sinceMs / 1000);

  const swaps: ParsedMintSwap[] = [];
  const seenSig = new Set<string>();
  let before: string | undefined;
  let pagesFetched = 0;
  let heliusCalls = 0;
  let txScanned = 0;
  let parserFailures = 0;
  let creditsEstimated = 0;
  let reachedWindowEdge = false;

  for (let page = 0; page < maxPages; page++) {
    // Retry on 429 with exponential backoff — Free plan shares 10 req/s with
    // live ingestion, so the rate budget is often saturated; wait for a gap.
    let result: Awaited<ReturnType<typeof fetchHeliusAddressTransactions>> | null = null;
    for (let attempt = 0; attempt <= 6; attempt++) {
      try {
        result = await fetchHeliusAddressTransactions(address, { before, limit: 100 });
        break;
      } catch (err) {
        const is429 = err instanceof Error && err.message.includes('429');
        if (is429 && attempt < 6) {
          await new Promise((r) => setTimeout(r, 800 * 2 ** attempt)); // 0.8s…51s
          continue;
        }
        throw err;
      }
    }
    if (!result) break;
    const { txs, calls, credits } = result;
    pagesFetched += 1;
    heliusCalls += calls;
    creditsEstimated += credits;
    if (txs.length === 0) break;

    before = txs[txs.length - 1]?.signature;

    for (const tx of txs) {
      const sig = tx.signature;
      if (!sig || seenSig.has(sig)) continue;
      seenSig.add(sig);

      if (tx.timestamp != null && tx.timestamp < sinceSec) {
        reachedWindowEdge = true;
        continue; // older than the 30d window
      }
      txScanned += 1;

      const mints = candidateMintsForWallet(tx, address);
      if (mints.length === 0) {
        parserFailures += 1;
        continue;
      }
      let matched = false;
      for (const mint of mints) {
        const parsed = parseSwapFromEnhancedTx({ tx, mint, solUsd: opts.solUsd });
        // Only keep trades where THIS wallet is the trader (feePayer).
        if (parsed.ok && parsed.swap.wallet === address) {
          swaps.push(parsed.swap);
          matched = true;
        }
      }
      if (!matched) parserFailures += 1;
    }

    const oldest = txs[txs.length - 1];
    if (oldest?.timestamp != null && oldest.timestamp < sinceSec) {
      reachedWindowEdge = true;
      break; // whole next page is out of window
    }
    if (txs.length < 100) break; // last page
    if (opts.pageDelayMs) {
      await new Promise((r) => setTimeout(r, opts.pageDelayMs));
    }
  }

  return {
    swaps,
    pagesFetched,
    heliusCalls,
    txScanned,
    parserFailures,
    creditsEstimated,
    reachedWindowEdge,
  };
}
