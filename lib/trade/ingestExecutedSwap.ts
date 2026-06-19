import 'server-only';

import { createAdminSupabase } from '@/lib/supabase/server';
import { fetchHeliusTransactionsBySignatures } from '@/lib/indexer/heliusEnhanced';
import { ingestQaSwapsFromEnhancedTxs, qaIndexerEnabled } from '@/lib/indexer/qaMintIngest';
import { backfillMintSwaps } from '@/lib/indexer/backfillMintSwaps';
import { isPointerQaMint } from '@/lib/qa/pointerQaMint';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * After a confirmed Pointer swap, pull the enhanced tx from Helius and upsert
 * `mint_swaps` so the token desk tape / holders / stats update immediately.
 */
export async function ingestExecutedSolSwap(opts: {
  mint: string;
  txSignature: string;
}): Promise<{ ingested: boolean; swapsInserted: number }> {
  const mint = opts.mint.trim();
  const sig = opts.txSignature.trim();
  if (!mint || !sig || !qaIndexerEnabled()) {
    return { ingested: false, swapsInserted: 0 };
  }

  const supabase = createAdminSupabase();

  // Non-QA mints: the QA ingest helpers throw on non-QA mints, so route through the
  // generalized backfill (the same engine the read routes use) so a just-confirmed
  // swap on any indexed mint shows up on the tape / holders / stats immediately,
  // not just the configured QA mint.
  if (!isPointerQaMint(mint)) {
    try {
      const report = await backfillMintSwaps(supabase, {
        mint,
        maxPagesPerTarget: 2,
        pageSize: 100,
        recordStatus: false,
      });
      return {
        ingested: report.swapsInserted > 0 || report.swapsSkippedDuplicate > 0,
        swapsInserted: report.swapsInserted,
      };
    } catch {
      return { ingested: false, swapsInserted: 0 };
    }
  }

  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) await sleep(1200);
    try {
      const { txs } = await fetchHeliusTransactionsBySignatures([sig]);
      if (txs.length === 0) continue;

      const report = await ingestQaSwapsFromEnhancedTxs(supabase, txs, {
        mint,
        swapSource: 'pointer_execute',
        recomputeStats: true,
      });

      if (report.swapsInserted > 0 || report.swapsSkippedDuplicate > 0) {
        return { ingested: true, swapsInserted: report.swapsInserted };
      }
    } catch {
      /* retry — Helius may lag a few seconds behind confirmation */
    }
  }

  return { ingested: false, swapsInserted: 0 };
}
