'use client';

import { useQuery } from '@tanstack/react-query';
import type { AppChainId } from '@/lib/chains/appChain';
import type { ResolvedWalletIdentity } from '@/lib/identity/types';

export function useIdentityLookup(chain: AppChainId, addresses: string[]) {
  const key = addresses.slice().sort().join(',');
  return useQuery({
    queryKey: ['identity-lookup', chain, key],
    queryFn: async () => {
      const res = await fetch('/api/identity/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chain, addresses }),
      });
      if (!res.ok) throw new Error('identity_lookup_failed');
      const json = (await res.json()) as { identities: Record<string, ResolvedWalletIdentity> };
      return json.identities;
    },
    enabled: addresses.length > 0,
    staleTime: 60_000,
  });
}
