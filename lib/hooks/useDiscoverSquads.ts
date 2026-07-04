'use client';

import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import type { SquadSample } from '@/lib/squads/sampleData';

/**
 * Discover squads with real, member-derived stats from `/api/squads/discover`.
 * The endpoint returns objects structurally identical to `SquadSample`, so the
 * existing hero/compact cards render them unchanged. `provisioned:false` means
 * the squads tables aren't migrated yet — treated as an empty list.
 */
export function useDiscoverSquads() {
  const { getAccessToken, authenticated } = usePointerAuth();
  const fetchSquads = useCallback(async (): Promise<SquadSample[]> => {
    const token = await getAccessToken();
    if (!token) return [];
    const res = await fetch('/api/squads/discover', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`discover_failed_${res.status}`);
    const json = (await res.json()) as { squads?: SquadSample[] };
    return json.squads ?? [];
  }, [getAccessToken]);

  return useQuery({
    queryKey: ['squads-discover'],
    enabled: authenticated,
    queryFn: fetchSquads,
    staleTime: 60_000,
  });
}
