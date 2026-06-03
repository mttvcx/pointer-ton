'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePointerAuth } from '@/lib/auth/pointerAuth';

export type TrackerListRow = {
  id: string;
  walletAddress: string;
  label: string | null;
  notify: boolean;
  groupId: string | null;
  createdAt: string;
};

/**
 * Shared TanStack query with {@link TrackersPanel} (`queryKey: ['trackers']`).
 */
export function useTrackedWalletsLookup(): {
  labelFor: (address: string | null | undefined) => string | null;
  isTracked: (address: string | null | undefined) => boolean;
  isLoading: boolean;
} {
  const { authenticated, getAccessToken } = usePointerAuth();

  const q = useQuery({
    queryKey: ['trackers'],
    enabled: authenticated,
    staleTime: 30_000,
    queryFn: async (): Promise<TrackerListRow[]> => {
      const token = await getAccessToken();
      if (!token) return [];
      const res = await fetch('/api/trackers', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return [];
      const json = (await res.json()) as { trackers?: TrackerListRow[] };
      return json.trackers ?? [];
    },
  });

  const labelByAddress = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const t of q.data ?? []) {
      m.set(t.walletAddress, t.label);
    }
    return m;
  }, [q.data]);

  const labelFor = (address: string | null | undefined) =>
    address ? (labelByAddress.get(address) ?? null) : null;

  const isTracked = (address: string | null | undefined) =>
    !!address && labelByAddress.has(address);

  return { labelFor, isTracked, isLoading: q.isLoading };
}
