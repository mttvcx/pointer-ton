'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { TokenExtendedMetrics } from '@/lib/types/tokenExtendedMetrics';
import { EMPTY_TOKEN_EXTENDED_METRICS } from '@/lib/dev/demoPolicy';
import { syntheticTokenExtendedMetrics } from '@/lib/dev/demoTokenFixtures';
import { useUiDemoMode } from '@/lib/hooks/useUiDemoMode';

export type TokenExtendedMetricsResult = {
  metrics: TokenExtendedMetrics | null;
  symbol: string | null;
};

/**
 * Shared extended-metrics query so the token header + buy panel (and any other
 * consumer) hit `/api/tokens/[mint]/extended-metrics` once per mint instead of
 * fanning out under separate cache keys.
 */
export function useTokenExtendedMetrics(mint: string) {
  const uiDemo = useUiDemoMode();
  const demoMetrics = useMemo(
    () => (uiDemo ? syntheticTokenExtendedMetrics(mint) : EMPTY_TOKEN_EXTENDED_METRICS),
    [uiDemo, mint],
  );

  const query = useQuery({
    queryKey: ['token-extended-metrics', mint],
    queryFn: async (): Promise<TokenExtendedMetricsResult> => {
      const res = await fetch(`/api/tokens/${encodeURIComponent(mint)}/extended-metrics`);
      const json: unknown = await res.json();
      if (!res.ok) return { metrics: null, symbol: null };
      if (typeof json === 'object' && json && 'metrics' in json) {
        const o = json as { metrics: TokenExtendedMetrics; symbol?: string | null };
        return { metrics: o.metrics, symbol: o.symbol ?? null };
      }
      return { metrics: null, symbol: null };
    },
    placeholderData: uiDemo ? { metrics: demoMetrics, symbol: null } : undefined,
    staleTime: 45_000,
  });

  const metrics: TokenExtendedMetrics =
    query.data?.metrics ?? (uiDemo ? demoMetrics : EMPTY_TOKEN_EXTENDED_METRICS);

  return {
    query,
    /** Resolved metrics with empty/demo fallback applied. */
    metrics,
    /** Raw nullable metrics from the response (null on failure / before load). */
    rawMetrics: query.data?.metrics ?? null,
    symbol: query.data?.symbol ?? null,
    demoMetrics,
    uiDemo,
    isLoading: query.isLoading && !query.data,
  };
}
