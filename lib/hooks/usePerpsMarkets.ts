'use client';

import { useQuery } from '@tanstack/react-query';
import type { PerpMarket } from '@/lib/perps/types';

export function usePerpsMarkets() {
  return useQuery({
    queryKey: ['perps-markets'],
    queryFn: async () => {
      const res = await fetch('/api/perps/markets');
      const json = (await res.json()) as { markets?: PerpMarket[]; error?: string };
      if (!res.ok || !json.markets?.length) {
        throw new Error(json.error ?? 'markets_failed');
      }
      return json.markets;
    },
    staleTime: 8_000,
    refetchInterval: 15_000,
  });
}

export function usePerpsL2Book(coin: string, mark: number, enabled = true) {
  return useQuery({
    queryKey: ['perps-l2', coin],
    queryFn: async () => {
      const qs = new URLSearchParams({ coin, mark: String(mark) });
      const res = await fetch(`/api/perps/l2?${qs}`);
      const json = (await res.json()) as { book?: import('@/lib/perps/types').PerpsL2Book; error?: string };
      if (!res.ok || !json.book) {
        throw new Error(json.error ?? 'l2_failed');
      }
      return json.book;
    },
    enabled: enabled && Boolean(coin),
    staleTime: 2_000,
    refetchInterval: 3_000,
  });
}
