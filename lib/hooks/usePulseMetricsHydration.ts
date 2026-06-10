'use client';

import { useEffect, useRef } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import type { AppChainId } from '@/lib/chains/appChain';
import type { PulseColumnId } from '@/lib/utils/constants';
import { mergePartialSnapshotIntoPulseCache } from '@/lib/pulse/realtimeCache';
import type { PulseTokenBundle } from '@/types/tokens';

function bundleNeedsMetrics(b: PulseTokenBundle): boolean {
  const s = b.snapshot;
  return (
    !s ||
    s.top10_holder_pct == null ||
    s.dev_holding_pct == null ||
    s.holder_count == null
  );
}

/**
 * Second-pass hydration: fetch holder metrics for visible rows that still show
 * em-dashes after the feed response (timeout / Moralis lag on brand-new mints).
 */
export function usePulseMetricsHydration(opts: {
  qc: QueryClient;
  column: PulseColumnId;
  chain: AppChainId;
  items: PulseTokenBundle[];
  enabled: boolean;
}) {
  const { qc, column, chain, items, enabled } = opts;
  const inflightRef = useRef<Set<string>>(new Set());
  const doneRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled || items.length === 0) return;

    const mints = items
      .filter(bundleNeedsMetrics)
      .map((b) => b.token.mint)
      .filter((m) => !doneRef.current.has(m) && !inflightRef.current.has(m))
      .slice(0, 16);

    if (mints.length === 0) return;

    for (const m of mints) inflightRef.current.add(m);

    const ac = new AbortController();
    void (async () => {
      try {
        const res = await fetch(
          `/api/pulse/metrics?mints=${encodeURIComponent(mints.join(','))}`,
          { signal: ac.signal },
        );
        if (!res.ok) return;
        const json = (await res.json()) as {
          metrics?: Record<
            string,
            {
              holder_count: number | null;
              top10_holder_pct: number | null;
              dev_holding_pct: number | null;
              sniperHolderPct: number | null;
            }
          >;
        };
        const metrics = json.metrics ?? {};
        for (const mint of mints) {
          const row = metrics[mint];
          if (!row) continue;
          doneRef.current.add(mint);
          mergePartialSnapshotIntoPulseCache(qc, column, chain, mint, {
            holder_count: row.holder_count,
            top10_holder_pct: row.top10_holder_pct,
            dev_holding_pct: row.dev_holding_pct,
            extended_metrics:
              row.sniperHolderPct != null
                ? { sniperHolderPct: row.sniperHolderPct }
                : undefined,
          });
        }
      } catch {
        /* ignore */
      } finally {
        for (const m of mints) inflightRef.current.delete(m);
      }
    })();

    return () => ac.abort();
  }, [qc, column, chain, items, enabled]);
}
