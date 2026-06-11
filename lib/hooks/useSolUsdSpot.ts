'use client';

import { useQuery } from '@tanstack/react-query';
import { SOL_MINT } from '@/lib/utils/addresses';

/** Live SOL/USD spot (Jupiter via /api/prices/mint). Null while loading or on failure. */
export function useSolUsdSpot(): number | null {
  const { data } = useQuery({
    queryKey: ['sol-usd-spot'],
    queryFn: async (): Promise<number | null> => {
      const res = await fetch(`/api/prices/mint?mint=${encodeURIComponent(SOL_MINT)}`);
      if (!res.ok) return null;
      const json = (await res.json()) as { usdPrice?: number | null };
      const px = json.usdPrice;
      return typeof px === 'number' && Number.isFinite(px) && px > 0 ? px : null;
    },
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    retry: 1,
  });
  return data ?? null;
}
