'use client';

import { useQuery } from '@tanstack/react-query';
import type { AppChainId } from '@/lib/chains/appChain';
import {
  emptyMarketLighthouseSnapshot,
  type LighthouseTf,
  type MarketLighthouseSnapshot,
} from '@/lib/market/marketLighthouseSnapshot';

async function fetchMarketLighthouse(
  chain: AppChainId,
  tf: LighthouseTf,
): Promise<MarketLighthouseSnapshot> {
  const qs = new URLSearchParams({ chain, tf });
  const res = await fetch(`/api/market/lighthouse?${qs.toString()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('lighthouse_fetch_failed');
  const json = (await res.json()) as { snapshot?: MarketLighthouseSnapshot };
  return json.snapshot ?? emptyMarketLighthouseSnapshot();
}

export function useMarketLighthouse(chain: AppChainId, tf: LighthouseTf) {
  return useQuery({
    queryKey: ['market-lighthouse', chain, tf],
    queryFn: () => fetchMarketLighthouse(chain, tf),
    staleTime: 20_000,
    refetchInterval: 45_000,
    placeholderData: (prev) => prev ?? emptyMarketLighthouseSnapshot(),
  });
}
