'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { importSeedRows } from '@/lib/identity/registry';
import { clearWalletIdentityCache } from '@/lib/identity/identityService';
import { useIdentityRegistryStore } from '@/store/identityRegistry';
import type { IdentitySeedRow } from '@/lib/identity/types';

/**
 * Loads the full server identity directory (2k+ KOLs) into the client-side
 * registry once per session. The registry is server-hydrated only, so without
 * this every client `resolveWalletIdentity` falls back to a short address.
 * Mounted once in the app shell. After import it clears the resolve cache and
 * bumps the registry version so already-mounted labels re-resolve.
 */
export function IdentityRegistryHydrator() {
  const bump = useIdentityRegistryStore((s) => s.bump);

  const { data } = useQuery({
    queryKey: ['identity-seeds'],
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
    queryFn: async (): Promise<IdentitySeedRow[]> => {
      const r = await fetch('/api/identity/seeds');
      if (!r.ok) return [];
      const j = (await r.json()) as { seeds?: IdentitySeedRow[] };
      return Array.isArray(j.seeds) ? j.seeds : [];
    },
  });

  useEffect(() => {
    if (!data || data.length === 0) return;
    try {
      importSeedRows(data);
      clearWalletIdentityCache();
      bump();
    } catch {
      // best-effort — labels just fall back to short addresses
    }
  }, [data, bump]);

  return null;
}
