import 'server-only';

import { backfillMintSwaps } from '@/lib/indexer/backfillMintSwaps';
import { getMintIndexStatus } from '@/lib/db/mintIndexStatus';
import { createAdminSupabase } from '@/lib/supabase/server';

const MIN_KICKOFF_GAP_MS = 2 * 60_000;

/**
 * When a token desk loads with no indexed swaps, kick off a small backfill in the
 * background so the trades tape and wallet stats can populate without waiting for cron.
 */
export function kickoffMintIndexIfEmpty(mint: string): void {
  void (async () => {
    const status = await getMintIndexStatus(mint);
    if (status?.status === 'indexing' && status.last_started_at) {
      const started = Date.parse(status.last_started_at);
      if (Number.isFinite(started) && Date.now() - started < MIN_KICKOFF_GAP_MS) {
        return;
      }
    }
    const supabase = createAdminSupabase();
    await backfillMintSwaps(supabase, {
      mint,
      maxPagesPerTarget: 4,
      pageSize: 100,
      recordStatus: true,
    });
  })().catch(() => {
    /* best-effort — cron will retry */
  });
}
