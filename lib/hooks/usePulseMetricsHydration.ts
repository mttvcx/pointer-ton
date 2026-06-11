'use client';

import { useEffect, useRef } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import type { AppChainId } from '@/lib/chains/appChain';
import type { PulseColumnId } from '@/lib/utils/constants';
import { mergePartialSnapshotIntoPulseCache } from '@/lib/pulse/realtimeCache';
import {
  devMigrateFractionFromBundle,
  proTradersCountFromBundle,
} from '@/lib/tokens/pulseStripHoverMetrics';
import type { PulseTokenBundle } from '@/types/tokens';

function bundleNeedsMetrics(b: PulseTokenBundle): boolean {
  const s = b.snapshot;
  const holdersMissing =
    !s ||
    s.top10_holder_pct == null ||
    s.dev_holding_pct == null ||
    s.holder_count == null;
  const stripMissing =
    proTradersCountFromBundle(b) == null ||
    devMigrateFractionFromBundle(b).denominator == null;
  return holdersMissing || stripMissing;
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
              pro_traders: number | null;
              dev_deploy_migrated: number | null;
              dev_deploy_total: number | null;
            }
          >;
        };
        const metrics = json.metrics ?? {};
        for (const mint of mints) {
          const row = metrics[mint];
          if (!row) continue;
          doneRef.current.add(mint);
          const ext: Record<string, unknown> = {};
          if (row.sniperHolderPct != null) ext.sniperHolderPct = row.sniperHolderPct;
          if (row.pro_traders != null) ext.pro_traders = row.pro_traders;
          if (row.dev_deploy_migrated != null) ext.dev_deploy_migrated = row.dev_deploy_migrated;
          if (row.dev_deploy_total != null) ext.dev_deploy_total = row.dev_deploy_total;
          mergePartialSnapshotIntoPulseCache(qc, column, chain, mint, {
            holder_count: row.holder_count,
            top10_holder_pct: row.top10_holder_pct,
            dev_holding_pct: row.dev_holding_pct,
            extended_metrics: Object.keys(ext).length > 0 ? ext : undefined,
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
