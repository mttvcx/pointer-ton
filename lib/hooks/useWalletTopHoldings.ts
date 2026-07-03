'use client';

import { useQuery } from '@tanstack/react-query';
import { useUiDemoMode } from '@/lib/hooks/useUiDemoMode';
import { mockTopHoldings, type TopHolderCredential } from '@/lib/walletIdentity/topHolder';

async function fetchTopHoldings(address: string): Promise<TopHolderCredential[]> {
  const res = await fetch(`/api/holdings?address=${encodeURIComponent(address)}`);
  if (!res.ok) return [];
  const json = (await res.json()) as { credentials?: TopHolderCredential[] };
  return json.credentials ?? [];
}

/**
 * Top-holder credentials for a wallet. In UI demo mode returns deterministic
 * mock credentials (so the card is visible pre-launch); otherwise reads the
 * live reverse index. `enabled` gates the fetch until the card actually opens.
 */
export function useWalletTopHoldings(address: string | null | undefined, enabled = true) {
  const uiDemo = useUiDemoMode();

  const query = useQuery({
    queryKey: ['wallet-top-holdings', address],
    queryFn: () => fetchTopHoldings(address as string),
    enabled: Boolean(address) && enabled && !uiDemo,
    staleTime: 60_000,
  });

  if (uiDemo && address) {
    return { credentials: mockTopHoldings(address), isLoading: false };
  }
  return { credentials: query.data ?? [], isLoading: query.isLoading };
}
